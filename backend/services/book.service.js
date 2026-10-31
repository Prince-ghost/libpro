import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { Book, User } from "../models/index.js";

const SORT_ORDER = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { priceMinor: 1, _id: 1 },
  price_desc: { priceMinor: -1, _id: -1 },
};

const notFound = () => new AppError(404, "NOT_FOUND", "Book not found.");
const locked = () => new AppError(409, "BOOK_LOCKED", "This listing can no longer be changed.");

// The only shapes of a listing that leave the server. Public: no seller id, no moderation state.
export function toDto(book, sellerName, { includePrivate = false } = {}) {
  const dto = {
    id: String(book._id),
    title: book.title,
    author: book.author,
    category: book.category,
    audience: book.audience,
    classOrCourse: book.classOrCourse,
    edition: book.edition,
    condition: book.condition,
    description: book.description,
    priceMinor: book.priceMinor,
    currency: book.currency,
    status: book.status,
    createdAt: book.createdAt,
    seller: { name: sellerName ?? "BookBack user" },
  };
  if (includePrivate) {
    dto.moderationState = book.moderationState;
    dto.updatedAt = book.updatedAt;
  }
  return dto;
}

const canManage = (book, actor) =>
  Boolean(actor) && (actor.role === "admin" || String(book.sellerId) === actor.id);

export async function sellerNameOf(sellerId) {
  const user = await User.findById(sellerId).select("name").lean();
  return user?.name;
}

export async function sellerNameMap(books) {
  const ids = [...new Set(books.map((b) => String(b.sellerId)))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: mongoose.trusted({ $in: ids }) }).select("name").lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Built from validated, allowlisted values only. Called once per query so every query gets a fresh object.
function buildPublicFilter(p) {
  const filter = { status: "active", moderationState: "approved" };
  if (p.category) filter.category = p.category;
  if (p.audience) filter.audience = p.audience;
  if (p.condition) filter.condition = p.condition;

  if (p.minPrice !== undefined || p.maxPrice !== undefined) {
    const range = {};
    if (p.minPrice !== undefined) range.$gte = p.minPrice;
    if (p.maxPrice !== undefined) range.$lte = p.maxPrice;
    filter.priceMinor = mongoose.trusted(range);
  }

  if (p.q) {
    const pattern = escapeRegex(p.q);
    const matches = (field) => ({ [field]: mongoose.trusted({ $regex: pattern, $options: "i" }) });
    filter.$or = mongoose.trusted(
      ["title", "author", "classOrCourse", "category"].map(matches)
    );
  }
  return filter;
}

function pageMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function listPublicBooks(p) {
  const [books, total] = await Promise.all([
    Book.find(buildPublicFilter(p))
      .sort(SORT_ORDER[p.sort])
      .skip((p.page - 1) * p.limit)
      .limit(p.limit)
      .lean(),
    Book.countDocuments(buildPublicFilter(p)),
  ]);
  const names = await sellerNameMap(books);
  return {
    items: books.map((b) => toDto(b, names.get(String(b.sellerId)))),
    meta: pageMeta(p.page, p.limit, total),
  };
}

export async function listMyBooks(actor, { page, limit }) {
  const filter = () => ({ sellerId: actor.id, status: mongoose.trusted({ $ne: "archived" }) });
  const [books, total] = await Promise.all([
    Book.find(filter())
      .sort(SORT_ORDER.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Book.countDocuments(filter()),
  ]);
  return {
    items: books.map((b) => toDto(b, actor.name, { includePrivate: true })),
    meta: pageMeta(page, limit, total),
  };
}

export async function getBook(id, actor) {
  const book = await Book.findById(id).lean();
  if (!book) throw notFound();
  const manages = canManage(book, actor);
  // Same 404 whether the listing is missing, pending, rejected or archived.
  if (!manages && (book.moderationState !== "approved" || book.status === "archived")) {
    throw notFound();
  }
  return toDto(book, await sellerNameOf(book.sellerId), { includePrivate: manages });
}

export async function createBook(actor, input) {
  // sellerId comes last and from the session, so nothing in the input can override it.
  const book = await Book.create({ ...input, sellerId: actor.id });
  return toDto(book, actor.name, { includePrivate: true });
}

export async function updateBook(id, actor, input) {
  const book = await Book.findById(id).lean();
  if (!book || !canManage(book, actor)) throw notFound();
  if (book.status !== "active") throw locked();

  const update = { ...input };
  // A seller's edit goes back to moderation; an admin's edit keeps the current state.
  if (String(book.sellerId) === actor.id) update.moderationState = "pending";

  // Conditional write: if the listing stopped being active meanwhile, nothing is changed.
  const updated = await Book.findOneAndUpdate(
    { _id: id, status: "active" },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!updated) throw locked();
  return toDto(updated, await sellerNameOf(updated.sellerId), { includePrivate: true });
}

export async function archiveBook(id, actor) {
  const book = await Book.findById(id).select("sellerId status").lean();
  if (!book || !canManage(book, actor)) throw notFound();
  if (book.status === "archived") return { id: String(book._id), status: "archived" };
  if (book.status !== "active") throw locked();

  const result = await Book.updateOne({ _id: id, status: "active" }, { $set: { status: "archived" } });
  if (result.modifiedCount === 0) throw locked();
  return { id: String(book._id), status: "archived" };
}
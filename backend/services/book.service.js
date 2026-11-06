import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { Book, Image, User } from "../models/index.js";

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
    images: (book.imageKeys ?? []).map(String), // photo ids, cover first
  };
  if (includePrivate) {
    dto.moderationState = book.moderationState;
    dto.updatedAt = book.updatedAt;
  }
  return dto;
}

const canManage = (book, actor) =>
  Boolean(actor) && (actor.role === "admin" || String(book.sellerId) === actor.id);

async function sellerNameOf(sellerId) {
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
    filter.$or = mongoose.trusted(["title", "author", "classOrCourse", "category"].map(matches));
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

// Puts the given photos on a listing. Each must belong to the seller and be free, or already be on this
// same listing. If even one is not usable, nothing is changed. Attaching removes the expiry timer.
async function attachImages({ ownerId, ids, bookId, session }) {
  const usable = () => ({
    _id: mongoose.trusted({ $in: ids }),
    ownerId,
    $or: mongoose.trusted([{ bookId: null }, { bookId }]),
  });
  const count = await Image.countDocuments(usable()).session(session);
  if (count !== ids.length) {
    throw new AppError(400, "VALIDATION_ERROR", "Some photos are not available. Please upload them again.", [
      { field: "imageKeys", issue: "Some photos are not available" },
    ]);
  }
  await Image.updateMany(usable(), { $set: { bookId }, $unset: { expireAt: 1 } }, { session });
}

export async function createBook(actor, input) {
  const { imageKeys = [], ...fields } = input;

  if (imageKeys.length === 0) {
    // sellerId comes last and from the session, so nothing in the input can override it.
    const book = await Book.create({ ...fields, sellerId: actor.id });
    return toDto(book, actor.name, { includePrivate: true });
  }

  // The listing and its photos are saved together or not at all.
  const book = await runInTransaction(async (session) => {
    const [created] = await Book.create([{ ...fields, sellerId: actor.id, imageKeys }], { session });
    await attachImages({ ownerId: actor.id, ids: imageKeys, bookId: created._id, session });
    return created;
  });
  return toDto(book, actor.name, { includePrivate: true });
}

export async function updateBook(id, actor, input) {
  const book = await Book.findById(id).lean();
  if (!book || !canManage(book, actor)) throw notFound();
  if (book.status !== "active") throw locked();

  const { imageKeys, ...fields } = input;
  const update = { ...fields };
  // A seller's edit goes back to moderation; an admin's edit keeps the current state.
  if (String(book.sellerId) === actor.id) update.moderationState = "pending";
  if (imageKeys !== undefined) update.imageKeys = imageKeys;

  // Photo changes need several writes, so they run as one transaction. Photos always have to belong to the
  // listing's seller, so an admin can remove or reorder photos but can never attach their own.
  const run = imageKeys === undefined ? (work) => work(undefined) : runInTransaction;
  const updated = await run(async (session) => {
    // Conditional write: if the listing stopped being active meanwhile, nothing is changed.
    const doc = await Book.findOneAndUpdate(
      { _id: id, status: "active" },
      { $set: update },
      { returnDocument: "after", runValidators: true, session }
    );
    if (!doc) return null;

    if (imageKeys !== undefined) {
      if (imageKeys.length > 0) {
        await attachImages({ ownerId: book.sellerId, ids: imageKeys, bookId: book._id, session });
      }
      const keep = new Set(imageKeys);
      const removed = (book.imageKeys ?? []).filter((key) => !keep.has(key));
      if (removed.length > 0) {
        await Image.deleteMany({ _id: mongoose.trusted({ $in: removed }), bookId: book._id }, { session });
      }
    }
    return doc;
  });
  if (!updated) throw locked();
  return toDto(updated, await sellerNameOf(updated.sellerId), { includePrivate: true });
}

export async function archiveBook(id, actor) {
  const book = await Book.findById(id).select("sellerId status").lean();
  if (!book || !canManage(book, actor)) throw notFound();
  if (book.status === "archived") return { id: String(book._id), status: "archived" };
  if (book.status !== "active") throw locked();

  const archived = await runInTransaction(async (session) => {
    const result = await Book.updateOne(
      { _id: id, status: "active" },
      { $set: { status: "archived", imageKeys: [] } },
      { session }
    );
    if (result.modifiedCount === 0) return false;
    await Image.deleteMany({ bookId: book._id }, { session }); // free the storage the photos used
    return true;
  });
  if (!archived) throw locked();
  return { id: String(book._id), status: "archived" };
}
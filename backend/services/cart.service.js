import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { Book, Cart } from "../models/index.js";
import { toDto, sellerNameMap } from "./book.service.js";

const MAX_CART_ITEMS = 50;

const isPurchasable = (book) =>
  Boolean(book) && book.moderationState === "approved" && book.status === "active";

export async function getCart(actor) {
  const cart = await Cart.findOne({ userId: actor.id }).lean();
  const entries = cart?.items ?? [];

  const books = entries.length
    ? await Book.find({ _id: mongoose.trusted({ $in: entries.map((e) => e.bookId) }) }).lean()
    : [];
  const byId = new Map(books.map((b) => [String(b._id), b]));

  const live = [];
  const removed = [];
  for (const entry of entries) {
    const book = byId.get(String(entry.bookId));
    if (isPurchasable(book)) live.push({ entry, book });
    else removed.push(entry.bookId);
  }

  // Stale cleanup: only the caller's own cart, only items that can no longer be bought.
  if (removed.length) {
    await Cart.updateOne({ userId: actor.id }, { $pull: { items: { bookId: { $in: removed } } } });
  }

  const names = await sellerNameMap(live.map((l) => l.book));
  const items = live.map(({ entry, book }) => ({
    book: toDto(book, names.get(String(book.sellerId))),
    quantity: 1,
    addedAt: entry.addedAt,
  }));
  // Informational only: checkout recomputes everything from the database.
  const subtotalMinor = items.reduce((sum, item) => sum + item.book.priceMinor, 0);

  return {
    cart: { items, count: items.length, subtotalMinor, currency: "INR" },
    removed: removed.map(String),
  };
}

export async function addToCart(actor, bookId) {
  const oid = new mongoose.Types.ObjectId(bookId);
  const book = await Book.findById(oid).select("sellerId status moderationState").lean();

  // Checked first: the owner can already see their own listing, so nothing leaks.
  if (book && String(book.sellerId) === actor.id) {
    throw new AppError(409, "OWN_LISTING", "You cannot buy your own listing.");
  }
  if (!book || book.moderationState !== "approved" || book.status === "archived") {
    throw new AppError(404, "NOT_FOUND", "Book not found.");
  }
  if (book.status !== "active") {
    throw new AppError(409, "BOOK_UNAVAILABLE", "This book is no longer available.");
  }

  const existing = await Cart.findOne({ userId: actor.id }).select("items.bookId").lean();
  const alreadyThere = existing?.items.some((item) => item.bookId.equals(oid));

  if (!alreadyThere) {
    if ((existing?.items.length ?? 0) >= MAX_CART_ITEMS) {
      throw new AppError(409, "CART_FULL", `Your cart can hold at most ${MAX_CART_ITEMS} books.`);
    }
    // Check and add in one atomic step: the filter only matches while the book is NOT in the cart.
    const filter = () => ({ userId: actor.id, "items.bookId": mongoose.trusted({ $ne: oid }) });
    const update = { $push: { items: { bookId: oid, quantity: 1, addedAt: new Date() } } };
    try {
      await Cart.updateOne(filter(), update, { upsert: true });
    } catch (err) {
      // Two first-time requests can race to create the cart; the loser retries without creating.
      if (err?.code !== 11000) throw err;
      await Cart.updateOne(filter(), update);
    }
  }
  return getCart(actor);
}

export async function removeFromCart(actor, bookId) {
  const oid = new mongoose.Types.ObjectId(bookId);
  // Scoped to the caller's own cart; removing something that is not there is fine.
  await Cart.updateOne({ userId: actor.id }, { $pull: { items: { bookId: oid } } });
  return getCart(actor);
}
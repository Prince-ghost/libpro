import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { Book, Wishlist } from "../models/index.js";
import { toDto, sellerNameMap } from "./book.service.js";

const MAX_WISHLIST = 200;

const isListed = (book) =>
  Boolean(book) && book.moderationState === "approved" && book.status !== "archived";

export async function getWishlist(actor) {
  const doc = await Wishlist.findOne({ userId: actor.id }).lean();
  const ids = [...(doc?.bookIds ?? [])].reverse(); // newest first
  if (ids.length === 0) return { items: [], count: 0 };

  const books = await Book.find({
    _id: mongoose.trusted({ $in: ids }),
    moderationState: "approved",
    status: mongoose.trusted({ $ne: "archived" }),
  }).lean();
  const byId = new Map(books.map((b) => [String(b._id), b]));
  const names = await sellerNameMap(books);

  // Hidden or deleted listings are left out of the response (not removed), so they can come back.
  const items = ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((book) => toDto(book, names.get(String(book.sellerId))));
  return { items, count: items.length };
}

export async function addToWishlist(actor, bookId) {
  const oid = new mongoose.Types.ObjectId(bookId);
  const book = await Book.findById(oid).select("status moderationState").lean();
  if (!isListed(book)) throw new AppError(404, "NOT_FOUND", "Book not found.");

  const doc = await Wishlist.findOne({ userId: actor.id }).select("bookIds").lean();
  if (!doc?.bookIds.some((id) => id.equals(oid))) {
    if ((doc?.bookIds.length ?? 0) >= MAX_WISHLIST) {
      throw new AppError(409, "WISHLIST_FULL", `Your wishlist can hold at most ${MAX_WISHLIST} books.`);
    }
    // $addToSet never creates a duplicate, even under concurrent requests.
    const run = (options) =>
      Wishlist.updateOne({ userId: actor.id }, { $addToSet: { bookIds: oid } }, options);
    try {
      await run({ upsert: true });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      await run({});
    }
  }
  return getWishlist(actor);
}

export async function removeFromWishlist(actor, bookId) {
  const oid = new mongoose.Types.ObjectId(bookId);
  await Wishlist.updateOne({ userId: actor.id }, { $pull: { bookIds: oid } });
  return getWishlist(actor);
}
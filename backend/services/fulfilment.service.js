import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { Book, Order } from "../models/index.js";
import { toOrderDto, toSellerOrderDto } from "./order.service.js";

const notFound = () => new AppError(404, "NOT_FOUND", "Order not found.");
// Orders placed before fulfilment existed have no value stored, which means "not shipped yet".
const stateOf = (item) => item.fulfilment ?? "pending";

// The order's overall status follows its books. ("confirmed" is not used yet.)
function deriveStatus(order) {
  if (order.status === "cancelled") return "cancelled";
  const states = order.items.map(stateOf);
  if (states.every((state) => state === "delivered")) return "delivered";
  if (states.some((state) => state !== "pending")) return "shipped";
  return "placed";
}

// Adds a timeline entry only when the overall status really changes, so a second seller shipping
// does not record "shipped" again.
function recordStatusChange(order) {
  const next = deriveStatus(order);
  if (next === order.status) return;
  order.status = next;
  order.timeline.push({ status: next, at: new Date() });
}

// A seller marks all of THEIR OWN books in an order as shipped. They can never touch another
// seller's books, and an order they are not selling on looks exactly like one that does not exist.
export async function markShipped(actor, id) {
  const order = await runInTransaction(async (session) => {
    const doc = await Order.findOne({ _id: id, sellerIds: actor.id }).session(session);
    if (!doc) throw notFound();
    if (doc.status === "cancelled") {
      throw new AppError(409, "ORDER_CANCELLED", "This order was cancelled, so there is nothing to ship.");
    }
    const pending = doc.items.filter((item) => String(item.sellerId) === actor.id && stateOf(item) === "pending");
    if (pending.length === 0) return doc; // already shipped: repeating is safe

    const now = new Date();
    for (const item of pending) {
      item.fulfilment = "shipped";
      item.shippedAt = now;
    }
    recordStatusChange(doc);
    // If two people change the same order at once, the database refuses one of the writes and the
    // transaction runs again on the fresh order, so nothing is lost.
    await doc.save({ session });
    return doc;
  });
  return toSellerOrderDto(order.toObject(), actor.id);
}

// Only the buyer can confirm that a book arrived. The book then becomes sold for good.
export async function confirmReceived(actor, id, bookId) {
  const order = await runInTransaction(async (session) => {
    const doc = await Order.findOne({ _id: id, buyerId: actor.id }).session(session);
    if (!doc) throw notFound();
    if (doc.status === "cancelled") {
      throw new AppError(409, "ORDER_CANCELLED", "This order was cancelled.");
    }
    const item = doc.items.find((entry) => String(entry.bookId) === bookId);
    if (!item) throw notFound(); // not a book in this order

    const state = stateOf(item);
    if (state === "delivered") return doc; // already confirmed: repeating is safe
    if (state !== "shipped") {
      throw new AppError(409, "NOT_SHIPPED", "The seller has not shipped this book yet.");
    }

    item.fulfilment = "delivered";
    item.deliveredAt = new Date();
    await Book.updateOne({ _id: item.bookId, status: "reserved" }, { $set: { status: "sold" } }, { session });
    recordStatusChange(doc);
    await doc.save({ session });
    return doc;
  });
  return toOrderDto(order.toObject());
}
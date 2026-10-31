import crypto from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { Address, Book, Cart, Order } from "../models/index.js";

const SHIPPING_FLAT_MINOR = 4000; // INR 40 per order, decided here, never by the client
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U
const ADDRESS_FIELDS = ["recipientName", "phone", "line1", "line2", "city", "state", "postalCode", "country"];
// A seller needs a name and an address to ship, but not the buyer's phone number.
const SELLER_ADDRESS_FIELDS = ["recipientName", "line1", "line2", "city", "state", "postalCode", "country"];

function generateOrderNumber() {
  const bytes = crypto.randomBytes(10);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % 32];
  return `BB-${code}`;
}

const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source[key] != null).map((key) => [key, source[key]]));
const snapshotAddress = (address) => pick(address, ADDRESS_FIELDS);

// Orders made before timelines existed have none stored, so "placed" is filled in from createdAt.
function timelineOf(order) {
  const events = (order.timeline ?? []).map((e) => ({ status: e.status, at: e.at }));
  if (events[0]?.status !== "placed") events.unshift({ status: "placed", at: order.createdAt });
  return events;
}

const isCancellable = (order) => order.status === "placed" && order.paymentStatus === "unpaid";

export function toOrderDto(order) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    cancellable: isCancellable(order),
    timeline: timelineOf(order),
    items: order.items.map((i) => ({
      bookId: String(i.bookId),
      title: i.title,
      author: i.author ?? null,
      unitPriceMinor: i.unitPriceMinor,
      quantity: i.quantity,
      imageKey: i.imageKey ?? null,
    })),
    shippingAddress: snapshotAddress(order.shippingAddress),
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

// What a seller may see: their own items only, a delivery address without the phone number,
// no buyer identity and no order total. Once an order is cancelled there is nothing to ship.
export function toSellerOrderDto(order, sellerId) {
  const mine = order.items.filter((i) => String(i.sellerId) === String(sellerId));
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    items: mine.map((i) => ({
      bookId: String(i.bookId),
      title: i.title,
      author: i.author ?? null,
      unitPriceMinor: i.unitPriceMinor,
      quantity: i.quantity,
    })),
    itemsSubtotalMinor: mine.reduce((sum, i) => sum + i.unitPriceMinor * i.quantity, 0),
    currency: order.currency,
    shipTo: order.status === "cancelled" ? null : pick(order.shippingAddress, SELLER_ADDRESS_FIELDS),
    timeline: timelineOf(order),
    createdAt: order.createdAt,
  };
}

const unavailable = (bookIds) =>
  new AppError(
    409,
    "ITEMS_UNAVAILABLE",
    "Some books in your cart are no longer available. Please review your cart.",
    bookIds.map((id) => ({ field: "items", bookId: String(id), issue: "No longer available" }))
  );

async function placeOrder(actor, addressId, idempotencyKey) {
  return runInTransaction(async (session) => {
    // 1. The address must belong to the buyer. Unknown and foreign look identical.
    const address = await Address.findOne({ _id: addressId, userId: actor.id }).session(session).lean();
    if (!address) throw new AppError(404, "NOT_FOUND", "Address not found.");

    // 2. The server reads the buyer's own cart. Nothing about items comes from the request.
    const cart = await Cart.findOne({ userId: actor.id }).session(session).lean();
    const entries = [...(cart?.items ?? [])].sort((a, b) => String(a.bookId).localeCompare(String(b.bookId)));
    if (entries.length === 0) throw new AppError(400, "EMPTY_CART", "Your cart is empty.");

    // 3. Current listings, prices and availability come from the database.
    const books = await Book.find({ _id: mongoose.trusted({ $in: entries.map((e) => e.bookId) }) })
      .session(session)
      .lean();
    const byId = new Map(books.map((b) => [String(b._id), b]));
    const bad = entries
      .filter((e) => {
        const b = byId.get(String(e.bookId));
        return !b || b.moderationState !== "approved" || b.status !== "active" || String(b.sellerId) === actor.id;
      })
      .map((e) => e.bookId);
    if (bad.length) throw unavailable(bad);

    // 4. Reserve every book. The filter only matches a book that is still active, so if another
    //    buyer got there first this matches nothing and the whole transaction is abandoned.
    for (const entry of entries) {
      const result = await Book.updateOne(
        { _id: entry.bookId, status: "active", moderationState: "approved" },
        { $set: { status: "reserved" } },
        { session }
      );
      if (result.modifiedCount !== 1) throw unavailable([entry.bookId]);
    }

    // 5. Snapshot and totals, all from database values, all in integer paise.
    const items = entries.map((e) => {
      const b = byId.get(String(e.bookId));
      return {
        bookId: b._id,
        sellerId: b.sellerId,
        title: b.title,
        author: b.author,
        unitPriceMinor: b.priceMinor,
        quantity: 1,
        imageKey: b.imageKeys?.[0] ?? null,
      };
    });
    const subtotalMinor = items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
    const shippingMinor = SHIPPING_FLAT_MINOR;

    const [order] = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          buyerId: actor.id,
          items,
          sellerIds: [...new Set(items.map((i) => String(i.sellerId)))],
          shippingAddress: snapshotAddress(address),
          subtotalMinor,
          shippingMinor,
          totalMinor: subtotalMinor + shippingMinor,
          currency: "INR",
          status: "placed",
          paymentStatus: "unpaid", // a browser redirect is never proof of payment
          timeline: [{ status: "placed", at: new Date() }],
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      ],
      { session }
    );

    // 6. Empty the cart in the same transaction.
    await Cart.updateOne({ userId: actor.id }, { $set: { items: [] } }, { session });
    return order;
  });
}

export async function createOrder(actor, { addressId, idempotencyKey }) {
  const findByKey = () =>
    idempotencyKey ? Order.findOne({ buyerId: actor.id, idempotencyKey }).lean() : null;

  // A retry of a request that already succeeded returns the original order.
  const replay = await findByKey();
  if (replay) return { order: toOrderDto(replay), created: false };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await placeOrder(actor, addressId, idempotencyKey);
      return { order: toOrderDto(order), created: true };
    } catch (err) {
      // If a parallel request with the same key won the race, answer with its order.
      const raced = await findByKey();
      if (raced) return { order: toOrderDto(raced), created: false };
      if (err?.code === 11000 && err.keyPattern?.orderNumber) continue; // order-number collision: try again
      throw err;
    }
  }
  throw new Error("Could not allocate an order number");
}

export async function listOrders(actor, { page, limit }) {
  const filter = () => ({ buyerId: actor.id });
  const [orders, total] = await Promise.all([
    Order.find(filter())
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter()),
  ]);
  return {
    items: orders.map(toOrderDto),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// The buyer's own view of an order.
export async function getOrder(actor, id) {
  const order = await Order.findOne({ _id: id, buyerId: actor.id }).lean();
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  return toOrderDto(order);
}

export async function cancelOrder(actor, id) {
  const mine = () => ({ _id: id, buyerId: actor.id });
  const existing = await Order.findOne(mine()).lean();
  if (!existing) throw new AppError(404, "NOT_FOUND", "Order not found."); // foreign and unknown look identical
  if (existing.status === "cancelled") return toOrderDto(existing); // repeating a cancel is safe
  if (!isCancellable(existing)) {
    throw new AppError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled.");
  }

  const cancelled = await runInTransaction(async (session) => {
    // Matches only while the order is still placed and unpaid, so two requests cannot both cancel it.
    const order = await Order.findOneAndUpdate(
      { ...mine(), status: "placed", paymentStatus: "unpaid" },
      { $set: { status: "cancelled" }, $push: { timeline: { status: "cancelled", at: new Date() } } },
      { returnDocument: "after", session }
    );
    if (!order) return null;
    // Release the books this order was holding.
    await Book.updateMany(
      { _id: mongoose.trusted({ $in: order.items.map((item) => item.bookId) }), status: "reserved" },
      { $set: { status: "active" } },
      { session }
    );
    return order;
  });

  if (cancelled) return toOrderDto(cancelled);
  // Another request changed the order first: report what it ended up as.
  const latest = await Order.findOne(mine()).lean();
  if (latest?.status === "cancelled") return toOrderDto(latest);
  throw new AppError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled.");
}

export async function listSellerOrders(actor, { page, limit }) {
  const filter = () => ({ sellerIds: actor.id });
  const [orders, total] = await Promise.all([
    Order.find(filter())
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter()),
  ]);
  return {
    items: orders.map((order) => toSellerOrderDto(order, actor.id)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSellerOrder(actor, id) {
  const order = await Order.findOne({ _id: id, sellerIds: actor.id }).lean();
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  return toSellerOrderDto(order, actor.id);
}
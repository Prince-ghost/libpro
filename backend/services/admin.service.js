import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { AuditEvent, Book, Order, Session, User } from "../models/index.js";

const notFound = (what) => new AppError(404, "NOT_FOUND", `${what} not found.`);
const conflict = () =>
  new AppError(409, "CONFLICT", "This record was changed by someone else. Please reload and try again.");

const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const skipOf = ({ page, limit }) => (page - 1) * limit;

async function namesOf(ids) {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: mongoose.trusted({ $in: unique }) }).select("name").lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

function toAdminBookDto(book, sellerName) {
  return {
    id: String(book._id),
    title: book.title,
    author: book.author,
    category: book.category,
    audience: book.audience,
    condition: book.condition,
    priceMinor: book.priceMinor,
    currency: book.currency,
    status: book.status,
    moderationState: book.moderationState,
    seller: { id: String(book.sellerId), name: sellerName ?? null },
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

function toAdminUserDto(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

// Minimal data on purpose: no address, phone number or email.
function toAdminOrderDto(order, buyerName) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    buyer: { id: String(order.buyerId), name: buyerName ?? null },
    itemCount: order.items.length,
    items: order.items.map((i) => ({ bookId: String(i.bookId), title: i.title, unitPriceMinor: i.unitPriceMinor })),
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

function toAuditDto(event) {
  return {
    id: String(event._id),
    action: event.action,
    source: event.source,
    actorId: event.actorId ? String(event.actorId) : null,
    targetType: event.targetType,
    targetId: String(event.targetId),
    details: event.details ?? {},
    createdAt: event.createdAt,
  };
}

// ---- Listings -------------------------------------------------------------------------------

export async function listBooks(params) {
  const filter = () => ({
    ...(params.moderationState && { moderationState: params.moderationState }),
    ...(params.status && { status: params.status }),
  });
  const [books, total] = await Promise.all([
    // Oldest first: the listing that has waited longest is handled first.
    Book.find(filter()).sort({ createdAt: 1, _id: 1 }).skip(skipOf(params)).limit(params.limit).lean(),
    Book.countDocuments(filter()),
  ]);
  const names = await namesOf(books.map((b) => b.sellerId));
  return {
    items: books.map((b) => toAdminBookDto(b, names.get(String(b.sellerId)))),
    meta: pageMeta(params.page, params.limit, total),
  };
}

export async function moderateBook(admin, id, { moderationState: to, reason }) {
  const book = await Book.findById(id).lean();
  if (!book) throw notFound("Book");
  const dto = async (doc) => toAdminBookDto(doc, (await namesOf([doc.sellerId])).get(String(doc.sellerId)));

  // Repeating a decision is safe and does not add a second audit entry.
  if (book.moderationState === to) return dto(book);

  const updated = await runInTransaction(async (session) => {
    // Matches only if nobody changed the listing since we read it (a seller edit changes updatedAt),
    // so an admin can never approve content they did not see.
    const changed = await Book.findOneAndUpdate(
      { _id: id, moderationState: book.moderationState, updatedAt: book.updatedAt },
      { $set: { moderationState: to } },
      { returnDocument: "after", session }
    ).lean();
    if (!changed) return null;
    await AuditEvent.create(
      [
        {
          actorId: admin.id,
          source: "api",
          action: "book.moderate",
          targetType: "book",
          targetId: book._id,
          details: { from: book.moderationState, to, ...(reason ? { reason } : {}) },
        },
      ],
      { session }
    );
    return changed;
  });

  if (updated) return dto(updated);
  // Someone else got there first: if they made the same decision, that is fine.
  const latest = await Book.findById(id).lean();
  if (latest?.moderationState === to) return dto(latest);
  throw conflict();
}

// ---- Orders ---------------------------------------------------------------------------------

export async function listOrders(params) {
  const filter = () => ({
    ...(params.status && { status: params.status }),
    ...(params.paymentStatus && { paymentStatus: params.paymentStatus }),
  });
  const [orders, total] = await Promise.all([
    Order.find(filter()).sort({ createdAt: -1, _id: -1 }).skip(skipOf(params)).limit(params.limit).lean(),
    Order.countDocuments(filter()),
  ]);
  const names = await namesOf(orders.map((o) => o.buyerId));
  return {
    items: orders.map((o) => toAdminOrderDto(o, names.get(String(o.buyerId)))),
    meta: pageMeta(params.page, params.limit, total),
  };
}

// ---- Users ----------------------------------------------------------------------------------

export async function listUsers(params) {
  const filter = () => ({
    ...(params.role && { role: params.role }),
    ...(params.status && { status: params.status }),
    ...(params.email && { email: params.email }),
  });
  const [users, total] = await Promise.all([
    User.find(filter()).sort({ createdAt: -1, _id: -1 }).skip(skipOf(params)).limit(params.limit).lean(),
    User.countDocuments(filter()),
  ]);
  return { items: users.map(toAdminUserDto), meta: pageMeta(params.page, params.limit, total) };
}

export async function setUserStatus(admin, id, status) {
  const oid = new mongoose.Types.ObjectId(id);
  if (String(oid) === admin.id) {
    throw new AppError(409, "CANNOT_MODIFY_SELF", "You cannot change your own account status.");
  }
  const user = await User.findById(oid).lean();
  if (!user) throw notFound("User");
  if (user.role !== "user") {
    throw new AppError(409, "ADMIN_PROTECTED", "Admin accounts cannot be changed here.");
  }
  if (user.status === status) return toAdminUserDto(user); // repeat is safe, no second audit entry

  const updated = await runInTransaction(async (session) => {
    // role: "user" in the filter means an account promoted a moment ago can never be touched.
    const changed = await User.findOneAndUpdate(
      { _id: oid, role: "user", status: user.status },
      { $set: { status } },
      { returnDocument: "after", session }
    ).lean();
    if (!changed) return null;
    if (status === "disabled") await Session.deleteMany({ userId: oid }, { session }); // log them out now
    await AuditEvent.create(
      [
        {
          actorId: admin.id,
          source: "api",
          action: "user.status",
          targetType: "user",
          targetId: oid,
          details: { from: user.status, to: status },
        },
      ],
      { session }
    );
    return changed;
  });

  if (updated) return toAdminUserDto(updated);
  const latest = await User.findById(oid).lean();
  if (latest && latest.role === "user" && latest.status === status) return toAdminUserDto(latest);
  throw conflict();
}

// ---- Audit log ------------------------------------------------------------------------------

export async function listAudit(params) {
  const [events, total] = await Promise.all([
    AuditEvent.find({}).sort({ createdAt: -1, _id: -1 }).skip(skipOf(params)).limit(params.limit).lean(),
    AuditEvent.countDocuments({}),
  ]);
  return { items: events.map(toAuditDto), meta: pageMeta(params.page, params.limit, total) };
}
import { AppError } from "../lib/http.js";
import { Book, ExchangeRequest } from "../models/index.js";

function dto(request) {
  const book = request.requestedBookId;
  const requester = request.requesterId;
  const owner = request.ownerId;
  return {
    id: String(request._id),
    status: request.status,
    message: request.message,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requestedBook: book?._id
      ? { id: String(book._id), title: book.title, author: book.author, priceMinor: book.priceMinor }
      : null,
    requester: requester?._id ? { id: String(requester._id), name: requester.name } : null,
    owner: owner?._id ? { id: String(owner._id), name: owner.name } : null,
  };
}

const populate = (query) =>
  query
    .populate("requestedBookId", "title author priceMinor")
    .populate("requesterId", "name")
    .populate("ownerId", "name");

export async function createExchangeRequest(requesterId, { requestedBookId, message }) {
  const book = await Book.findOne({
    _id: requestedBookId,
    status: "active",
    moderationState: "approved",
  }).select("sellerId");
  if (!book) throw new AppError(404, "BOOK_UNAVAILABLE", "This book is not available for exchange.");
  if (String(book.sellerId) === String(requesterId)) {
    throw new AppError(409, "OWN_LISTING", "You cannot request an exchange for your own book.");
  }

  try {
    const request = await ExchangeRequest.create({
      requesterId,
      ownerId: book.sellerId,
      requestedBookId,
      message,
    });
    return dto(await populate(ExchangeRequest.findById(request._id)));
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(409, "EXCHANGE_EXISTS", "You already have a pending request for this book.");
    }
    throw err;
  }
}

export async function listExchangeRequests(userId, role, page, limit) {
  const filter = role === "received" ? { ownerId: userId } : { requesterId: userId };
  const [requests, total] = await Promise.all([
    populate(
      ExchangeRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ),
    ExchangeRequest.countDocuments(filter),
  ]);
  return {
    items: requests.map(dto),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateExchangeRequest(userId, id, status) {
  const request = await ExchangeRequest.findOne({ _id: id, ownerId: userId, status: "pending" });
  if (!request) throw new AppError(404, "EXCHANGE_NOT_FOUND", "Pending exchange request not found.");
  if (status === "accepted") {
    const book = await Book.findOne({
      _id: request.requestedBookId,
      status: "active",
      moderationState: "approved",
    });
    if (!book) throw new AppError(409, "BOOK_UNAVAILABLE", "This book is no longer available for exchange.");
  }
  request.status = status;
  await request.save();
  return dto(await populate(ExchangeRequest.findById(request._id)));
}

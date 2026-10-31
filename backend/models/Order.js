import mongoose from "mongoose";

const integer = { validator: Number.isInteger, message: "must be a whole number" };
const STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"];

// Copies of the book as it was at purchase time. No endpoint edits these.
const itemSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    author: { type: String },
    unitPriceMinor: { type: Number, required: true, min: 1, validate: integer },
    quantity: { type: Number, default: 1, min: 1, max: 1 },
    imageKey: { type: String, default: null },
  },
  { _id: false }
);

const shippingSchema = new mongoose.Schema(
  {
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

// One entry each time the order enters a new internal status.
const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [itemSchema],
      validate: { validator: (list) => list.length > 0, message: "An order needs at least one item" },
    },
    sellerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    shippingAddress: { type: shippingSchema, required: true },
    subtotalMinor: { type: Number, required: true, min: 0, validate: integer },
    shippingMinor: { type: Number, required: true, min: 0, validate: integer },
    totalMinor: { type: Number, required: true, min: 0, validate: integer },
    currency: { type: String, enum: ["INR"], default: "INR" },
    // Order status and payment status are separate on purpose.
    status: { type: String, enum: STATUSES, default: "placed" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    timeline: { type: [timelineSchema], default: [] },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerIds: 1, createdAt: -1 });
orderSchema.index(
  { buyerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
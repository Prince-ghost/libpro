import mongoose from "mongoose";

const exchangeRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedBookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

exchangeRequestSchema.index(
  { requesterId: 1, requestedBookId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export default mongoose.models.ExchangeRequest ||
  mongoose.model("ExchangeRequest", exchangeRequestSchema);

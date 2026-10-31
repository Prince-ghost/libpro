import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: {
      type: [
        {
          bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
          // Used books are single-copy, so quantity can only ever be 1.
          quantity: { type: Number, default: 1, min: 1, max: 1 },
          addedAt: { type: Date, default: Date.now },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default mongoose.models.Cart || mongoose.model("Cart", cartSchema);
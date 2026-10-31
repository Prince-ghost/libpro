import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bookIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);
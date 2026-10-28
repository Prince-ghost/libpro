import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    audience: {
      type: String,
      required: true,
      enum: ["school", "college", "competitive", "reference", "other"],
    },
    classOrCourse: { type: String, trim: true, maxlength: 100 },
    edition: { type: String, trim: true, maxlength: 50 },
    condition: { type: String, required: true, enum: ["like_new", "good", "fair", "poor"] },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    // Money is stored as integer paise, never as floating point rupees.
    priceMinor: {
      type: Number,
      required: true,
      min: 1,
      max: 10000000,
      validate: { validator: Number.isInteger, message: "priceMinor must be an integer" },
    },
    currency: { type: String, enum: ["INR"], default: "INR" },
    imageKeys: {
      type: [String],
      default: [],
      validate: { validator: (a) => a.length <= 5, message: "At most 5 images" },
    },
    status: { type: String, enum: ["active", "reserved", "sold", "archived"], default: "active" },
    moderationState: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

bookSchema.index({ status: 1, moderationState: 1, createdAt: -1 }); // public browse
bookSchema.index({ category: 1, status: 1 });
bookSchema.index({ sellerId: 1, createdAt: -1 }); // seller's own listings

export default mongoose.models.Book || mongoose.model("Book", bookSchema);
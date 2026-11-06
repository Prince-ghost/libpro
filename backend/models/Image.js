import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Empty until the photo is attached to a listing.
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", default: null },
    contentType: { type: String, enum: ["image/webp"], default: "image/webp" },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    bytes: { type: Number, required: true },
    // The picture data is only loaded when a query asks for it with select("+full") or select("+thumb").
    full: { type: Buffer, required: true, select: false },
    thumb: { type: Buffer, required: true, select: false },
    // Only set while the upload is not on a listing. MongoDB deletes the document after this time,
    // and attaching the photo removes the field, so listing photos are never deleted by the timer.
    expireAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

imageSchema.index({ ownerId: 1, bookId: 1 });
imageSchema.index({ bookId: 1 });
imageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Image || mongoose.model("Image", imageSchema);
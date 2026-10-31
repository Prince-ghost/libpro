import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    postalCode: { type: String, required: true, trim: true, maxlength: 10 },
    country: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 2, default: "IN" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ userId: 1, createdAt: -1 });
// The database itself guarantees at most one default address per user.
addressSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isDefault: true }, name: "one_default_per_user" }
);

export default mongoose.models.Address || mongoose.model("Address", addressSchema);
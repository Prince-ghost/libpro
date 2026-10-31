import mongoose from "mongoose";

// Append-only record of sensitive actions. The application has no route that edits or deletes it.
const auditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null for command-line actions
    source: { type: String, enum: ["api", "cli"], required: true },
    action: {
      type: String,
      enum: ["book.moderate", "user.status", "admin.grant", "admin.revoke"],
      required: true,
    },
    targetType: { type: String, enum: ["book", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // built by our code only, never copied from a request
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.models.AuditEvent || mongoose.model("AuditEvent", auditSchema);
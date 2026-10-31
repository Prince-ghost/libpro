import argon2 from "argon2";
import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { User, Session } from "../models/index.js";
import { hashToken } from "./auth.service.js";

// The only shape of a profile that leaves the server.
const toProfile = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const missing = () => new AppError(404, "NOT_FOUND", "Profile not found.");

export async function getProfile(actor) {
  const user = await User.findById(actor.id).lean();
  if (!user) throw missing();
  return toProfile(user);
}

export async function updateProfile(actor, { name }) {
  const user = await User.findByIdAndUpdate(
    actor.id,
    { $set: { name } },
    { returnDocument: "after", runValidators: true }
  ).lean();
  if (!user) throw missing();
  return toProfile(user);
}

export async function changePassword(actor, { currentPassword, newPassword }, currentToken) {
  const user = await User.findById(actor.id).select("+passwordHash").lean();
  const valid = user ? await argon2.verify(user.passwordHash, currentPassword).catch(() => false) : false;
  if (!valid) {
    throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect.", [
      { field: "currentPassword", issue: "Incorrect" },
    ]);
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await User.updateOne({ _id: actor.id }, { $set: { passwordHash } });

  // End every other session (a stolen one included) but keep the one making this request.
  const keep = currentToken ? hashToken(currentToken) : null;
  const filter = keep
    ? { userId: actor.id, tokenHash: mongoose.trusted({ $ne: keep }) }
    : { userId: actor.id };
  await Session.deleteMany(filter);
  return { passwordChanged: true };
}
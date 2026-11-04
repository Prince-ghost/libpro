import crypto from "node:crypto";
import argon2 from "argon2";
import mongoose from "mongoose";
import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { User, Session } from "../models/index.js";
import { createSession, toSafeUser } from "./auth.service.js";

const denied = () => new AppError(401, "SIGNIN_FAILED", "Sign-in failed. Please try again.");

// Nobody knows this password, so password login can never succeed for such an account.
const unusablePasswordHash = () =>
  argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id });

// Google display names are untrusted text: strip control characters, trim and cap the length.
function cleanName(name, email) {
  const fromGoogle = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (fromGoogle.length >= 2) return fromGoogle;
  const fallback = email.split("@")[0].slice(0, 80);
  return fallback.length >= 2 ? fallback : "BookBack user";
}

// Our sign-up does not verify emails, so someone could register a victim's address with their own
// password beforehand. Linking therefore also kills the old password and every old session.
async function linkAccount(userId, sub) {
  const passwordHash = await unusablePasswordHash();
  return runInTransaction(async (session) => {
    const linked = await User.findOneAndUpdate(
      { _id: userId, status: "active", googleId: mongoose.trusted({ $exists: false }) },
      { $set: { googleId: sub, passwordHash } },
      { returnDocument: "after", session }
    );
    if (!linked) return null;
    await Session.deleteMany({ userId }, { session });
    return linked;
  });
}

export async function loginWithGoogle(profile, attempt = 0) {
  const { sub, email } = profile;
  // Two sign-ins racing each other: the loser starts over once and finds what the winner created.
  const retry = () => {
    if (attempt >= 1) throw new AppError(409, "CONFLICT", "Please try again.");
    return loginWithGoogle(profile, attempt + 1);
  };

  let user = await User.findOne({ googleId: sub }).select("+googleId");

  if (!user) {
    const byEmail = await User.findOne({ email }).select("+googleId");
    if (byEmail) {
      // The email belongs to someone else's Google account, or the account is disabled: refuse.
      if (byEmail.googleId || byEmail.status !== "active") throw denied();
      user = await linkAccount(byEmail._id, sub);
      if (!user) return retry();
    } else {
      const passwordHash = await unusablePasswordHash();
      try {
        user = await User.create({ name: cleanName(profile.name, email), email, passwordHash, googleId: sub });
      } catch (err) {
        if (err?.code === 11000) return retry();
        throw err;
      }
    }
  }

  if (user.status !== "active") throw denied();
  const { token, expiresAt } = await createSession(user._id);
  return { user: toSafeUser(user), token, expiresAt };
}
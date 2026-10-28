import crypto from "node:crypto";
import argon2 from "argon2";
import mongoose from "mongoose";
import { env } from "../lib/env.js";
import { AppError } from "../lib/http.js";
import { User, Session } from "../models/index.js";

const SESSION_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

// Verified against when the email is unknown, so unknown email and wrong password take similar time.
const DUMMY_HASH = await argon2.hash("not-a-real-password", { type: argon2.argon2id });

export const generateToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// The only shape of a user that ever leaves the server.
export function toSafeUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export async function registerUser({ name, email, password }) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    // Fields are listed one by one: role and status come from schema defaults, never from the client.
    const user = await User.create({ name, email, passwordHash });
    return toSafeUser(user);
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }
    throw err;
  }
}

async function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await Session.create({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);

  if (!user || !valid || user.status !== "active") {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  const { token, expiresAt } = await createSession(user._id);
  return { user: toSafeUser(user), token, expiresAt };
}

export async function destroySession(token) {
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function getUserBySessionToken(token) {
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  });
  if (!session) return null;
  const user = await User.findById(session.userId);
  if (!user || user.status !== "active") return null;
  return toSafeUser(user);
}
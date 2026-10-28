import { env } from "./env.js";
import { AppError } from "./http.js";
import { getUserBySessionToken } from "../services/auth.service.js";

export const COOKIE_NAME = "bookback_sid";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, expires: expiresAt });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

async function userFromRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  // Insist on a string: cookie-parser can turn "j:{...}" cookies into objects.
  return typeof token === "string" ? getUserBySessionToken(token) : null;
}

// Protected routes: sets req.user or answers 401.
export async function requireAuth(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) {
    return next(new AppError(401, "UNAUTHENTICATED", "Please log in to continue."));
  }
  req.user = user;
  next();
}

// Public routes that behave differently for a logged-in owner or admin.
// Never fails: req.user is the user, or null.
export async function optionalAuth(req, res, next) {
  req.user = await userFromRequest(req);
  next();
}

// The role is read from the database through the session, never from the request.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "You do not have access to this resource."));
    }
    next();
  };
}
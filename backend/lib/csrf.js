import { env } from "./env.js";
import { AppError } from "./http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Browsers always send Origin on cross-site POST/PATCH/DELETE.
// If it is present and not our frontend, the request is refused.
export function originCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && origin !== env.CLIENT_ORIGIN) {
    return next(new AppError(403, "CSRF_BLOCKED", "Request origin is not allowed."));
  }
  next();
}
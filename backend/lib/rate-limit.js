import { rateLimit } from "express-rate-limit";
import { sendError } from "./http.js";

export function createLimiter({ windowMs, max, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) =>
      sendError(req, res, 429, "RATE_LIMITED", "Too many attempts. Please try again later."),
  });
}
// Note: this store lives in memory. A multi-server production deployment needs a shared store.
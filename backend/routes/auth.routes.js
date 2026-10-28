import { Router } from "express";
import { env } from "../lib/env.js";
import { createLimiter } from "../lib/rate-limit.js";
import { parseBody } from "../lib/validate.js";
import { COOKIE_NAME, requireAuth, setSessionCookie, clearSessionCookie } from "../lib/auth.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import { registerUser, loginUser, destroySession } from "../services/auth.service.js";

const router = Router();

const registerLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: env.AUTH_RATE_LIMIT_MAX });
// Only failed logins count, so normal use is never throttled.
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
});

router.post("/register", registerLimiter, async (req, res) => {
  const input = parseBody(registerSchema, req.body);
  const user = await registerUser(input);
  res.status(201).json({ data: { user }, meta: { requestId: req.id } });
});

router.post("/login", loginLimiter, async (req, res) => {
  const input = parseBody(loginSchema, req.body);
  const { user, token, expiresAt } = await loginUser(input);
  setSessionCookie(res, token, expiresAt); // the token goes only in the cookie, never in the body
  res.status(200).json({ data: { user }, meta: { requestId: req.id } });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token === "string") await destroySession(token);
  clearSessionCookie(res);
  res.status(200).json({ data: { loggedOut: true }, meta: { requestId: req.id } });
});

router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ data: { user: req.user }, meta: { requestId: req.id } });
});

export default router;
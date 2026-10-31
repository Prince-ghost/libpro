import { Router } from "express";
import { env } from "../lib/env.js";
import { COOKIE_NAME, requireAuth } from "../lib/auth.js";
import { createLimiter } from "../lib/rate-limit.js";
import { parseBody } from "../lib/validate.js";
import { updateProfileSchema, changePasswordSchema } from "../schemas/profile.schema.js";
import * as profile from "../services/profile.service.js";

const router = Router();
router.use(requireAuth);

// Only wrong attempts count, so guessing the current password is throttled.
const passwordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
});

const send = (req, res, data) => res.status(200).json({ data, meta: { requestId: req.id } });

router.get("/", async (req, res) => {
  send(req, res, await profile.getProfile(req.user));
});

router.patch("/", async (req, res) => {
  const input = parseBody(updateProfileSchema, req.body);
  send(req, res, await profile.updateProfile(req.user, input));
});

router.post("/password", passwordLimiter, async (req, res) => {
  const input = parseBody(changePasswordSchema, req.body);
  const token = req.cookies?.[COOKIE_NAME];
  send(req, res, await profile.changePassword(req.user, input, typeof token === "string" ? token : ""));
});

export default router;
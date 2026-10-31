import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { parseObjectId } from "../lib/validate.js";
import * as wishlistService from "../services/wishlist.service.js";

const router = Router();
router.use(requireAuth);

const send = (req, res, data) =>
  res.status(200).json({ data, meta: { requestId: req.id } });

router.get("/", async (req, res) => {
  send(req, res, await wishlistService.getWishlist(req.user));
});

router.post("/:bookId", async (req, res) => {
  const bookId = parseObjectId(req.params.bookId);
  send(req, res, await wishlistService.addToWishlist(req.user, bookId));
});

router.delete("/:bookId", async (req, res) => {
  const bookId = parseObjectId(req.params.bookId);
  send(req, res, await wishlistService.removeFromWishlist(req.user, bookId));
});

export default router;
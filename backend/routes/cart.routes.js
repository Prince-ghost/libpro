import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { parseBody, parseObjectId } from "../lib/validate.js";
import { addCartItemSchema } from "../schemas/cart.schema.js";
import * as cartService from "../services/cart.service.js";

const router = Router();
router.use(requireAuth); // every cart route needs a login; the user always comes from the session

const send = (req, res, { cart, removed }) =>
  res.status(200).json({ data: cart, meta: { removed, requestId: req.id } });

router.get("/", async (req, res) => {
  send(req, res, await cartService.getCart(req.user));
});

router.post("/items", async (req, res) => {
  const { bookId } = parseBody(addCartItemSchema, req.body);
  send(req, res, await cartService.addToCart(req.user, bookId));
});

router.delete("/items/:bookId", async (req, res) => {
  const bookId = parseObjectId(req.params.bookId);
  send(req, res, await cartService.removeFromCart(req.user, bookId));
});

export default router;
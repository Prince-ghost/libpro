import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { parseQuery, parseObjectId } from "../lib/validate.js";
import { pageQuerySchema } from "../schemas/book.schema.js";
import * as orders from "../services/order.service.js";

const router = Router();
router.use(requireAuth); // any logged-in user may call this; it only ever returns orders they sell on

const send = (req, res, data, meta = {}) =>
  res.status(200).json({ data, meta: { ...meta, requestId: req.id } });

router.get("/orders", async (req, res) => {
  const params = parseQuery(pageQuerySchema, req.query);
  const { items, meta } = await orders.listSellerOrders(req.user, params);
  send(req, res, items, meta);
});

router.get("/orders/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, await orders.getSellerOrder(req.user, id));
});

export default router;
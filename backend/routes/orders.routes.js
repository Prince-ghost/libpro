import { Router } from "express";
import { env } from "../lib/env.js";
import { requireAuth } from "../lib/auth.js";
import { createLimiter } from "../lib/rate-limit.js";
import { parseBody, parseQuery, parseObjectId } from "../lib/validate.js";
import { createOrderSchema, idempotencyHeaderSchema } from "../schemas/order.schema.js";
import { pageQuerySchema } from "../schemas/book.schema.js";
import * as orders from "../services/order.service.js";

const router = Router();
router.use(requireAuth);

const orderLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: env.ORDER_RATE_LIMIT_MAX });

const send = (req, res, status, data, meta = {}) =>
  res.status(status).json({ data, meta: { ...meta, requestId: req.id } });

router.post("/", orderLimiter, async (req, res) => {
  const { addressId } = parseBody(createOrderSchema, req.body);
  const { idempotencyKey } = parseBody(idempotencyHeaderSchema, {
    idempotencyKey: req.get("idempotency-key"),
  });
  const { order, created } = await orders.createOrder(req.user, { addressId, idempotencyKey });
  send(req, res, created ? 201 : 200, order);
});

router.get("/", async (req, res) => {
  const params = parseQuery(pageQuerySchema, req.query);
  const { items, meta } = await orders.listOrders(req.user, params);
  send(req, res, 200, items, meta);
});

router.get("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, 200, await orders.getOrder(req.user, id));
});

router.post("/:id/cancel", async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, 200, await orders.cancelOrder(req.user, id));
});

export default router;
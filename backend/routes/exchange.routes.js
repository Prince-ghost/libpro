import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { parseBody, parseObjectId, parseQuery } from "../lib/validate.js";
import { pageQuerySchema } from "../schemas/book.schema.js";
import { createExchangeSchema, exchangeStatusSchema } from "../schemas/exchange.schema.js";
import * as exchanges from "../services/exchange.service.js";

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res) => {
  const input = parseBody(createExchangeSchema, req.body);
  res.status(201).json({ data: await exchanges.createExchangeRequest(req.user.id, input), meta: { requestId: req.id } });
});

router.get("/mine", async (req, res) => {
  const { page, limit } = parseQuery(pageQuerySchema, req.query);
  const result = await exchanges.listExchangeRequests(req.user.id, "sent", page, limit);
  res.status(200).json({ data: result.items, meta: { ...result.meta, requestId: req.id } });
});

router.get("/received", async (req, res) => {
  const { page, limit } = parseQuery(pageQuerySchema, req.query);
  const result = await exchanges.listExchangeRequests(req.user.id, "received", page, limit);
  res.status(200).json({ data: result.items, meta: { ...result.meta, requestId: req.id } });
});

router.patch("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const { status } = parseBody(exchangeStatusSchema, req.body);
  res.status(200).json({
    data: await exchanges.updateExchangeRequest(req.user.id, id, status),
    meta: { requestId: req.id },
  });
});

export default router;

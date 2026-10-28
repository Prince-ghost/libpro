import { Router } from "express";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import { parseBody, parseQuery, parseObjectId } from "../lib/validate.js";
import {
  createBookSchema,
  updateBookSchema,
  browseQuerySchema,
  pageQuerySchema,
} from "../schemas/book.schema.js";
import * as books from "../services/book.service.js";

const router = Router();

const send = (req, res, status, data, meta = {}) =>
  res.status(status).json({ data, meta: { ...meta, requestId: req.id } });

// Public: search, filter, sort, paginate.
router.get("/", async (req, res) => {
  const params = parseQuery(browseQuerySchema, req.query);
  const { items, meta } = await books.listPublicBooks(params);
  send(req, res, 200, items, meta);
});

// Must stay above "/:id", or "mine" would be read as an id.
router.get("/mine", requireAuth, async (req, res) => {
  const params = parseQuery(pageQuerySchema, req.query);
  const { items, meta } = await books.listMyBooks(req.user, params);
  send(req, res, 200, items, meta);
});

router.post("/", requireAuth, async (req, res) => {
  const input = parseBody(createBookSchema, req.body);
  send(req, res, 201, await books.createBook(req.user, input));
});

router.get("/:id", optionalAuth, async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, 200, await books.getBook(id, req.user));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const id = parseObjectId(req.params.id);
  const input = parseBody(updateBookSchema, req.body);
  send(req, res, 200, await books.updateBook(id, req.user, input));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, 200, await books.archiveBook(id, req.user));
});

export default router;
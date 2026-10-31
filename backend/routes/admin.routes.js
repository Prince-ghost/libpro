import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseBody, parseQuery, parseObjectId } from "../lib/validate.js";
import { pageQuerySchema } from "../schemas/book.schema.js";
import {
  adminBooksQuerySchema,
  adminOrdersQuerySchema,
  adminUsersQuerySchema,
  moderateBookSchema,
  updateUserStatusSchema,
} from "../schemas/admin.schema.js";
import * as admin from "../services/admin.service.js";

const router = Router();

// Every admin route: logged in (401 otherwise) and an admin (403 otherwise).
// The role is read from the database for each request, never from anything the client sends.
router.use(requireAuth, requireRole("admin"));

const send = (req, res, data, meta = {}) =>
  res.status(200).json({ data, meta: { ...meta, requestId: req.id } });

router.get("/books", async (req, res) => {
  const params = parseQuery(adminBooksQuerySchema, req.query);
  const { items, meta } = await admin.listBooks(params);
  send(req, res, items, meta);
});

router.patch("/books/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const input = parseBody(moderateBookSchema, req.body);
  send(req, res, await admin.moderateBook(req.user, id, input));
});

router.get("/orders", async (req, res) => {
  const params = parseQuery(adminOrdersQuerySchema, req.query);
  const { items, meta } = await admin.listOrders(params);
  send(req, res, items, meta);
});

router.get("/users", async (req, res) => {
  const params = parseQuery(adminUsersQuerySchema, req.query);
  const { items, meta } = await admin.listUsers(params);
  send(req, res, items, meta);
});

router.patch("/users/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const { status } = parseBody(updateUserStatusSchema, req.body);
  send(req, res, await admin.setUserStatus(req.user, id, status));
});

router.get("/audit", async (req, res) => {
  const params = parseQuery(pageQuerySchema, req.query);
  const { items, meta } = await admin.listAudit(params);
  send(req, res, items, meta);
});

export default router;
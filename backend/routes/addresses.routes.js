import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { parseBody, parseObjectId } from "../lib/validate.js";
import { createAddressSchema, updateAddressSchema } from "../schemas/address.schema.js";
import * as addresses from "../services/address.service.js";

const router = Router();
router.use(requireAuth); // the owner always comes from the session

const send = (req, res, status, data) =>
  res.status(status).json({ data, meta: { requestId: req.id } });

router.get("/", async (req, res) => {
  send(req, res, 200, await addresses.listAddresses(req.user));
});

router.post("/", async (req, res) => {
  const input = parseBody(createAddressSchema, req.body);
  send(req, res, 201, await addresses.createAddress(req.user, input));
});

router.patch("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const input = parseBody(updateAddressSchema, req.body);
  send(req, res, 200, await addresses.updateAddress(req.user, id, input));
});

router.delete("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  send(req, res, 200, await addresses.deleteAddress(req.user, id));
});

export default router;
import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid book id");

export const createExchangeSchema = z.object({
  requestedBookId: objectId,
  message: z.string().trim().max(500, "Message is too long").optional().default(""),
});

export const exchangeStatusSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

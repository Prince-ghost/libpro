import { z } from "zod";

// Only the address is chosen by the client. Prices, totals, status and buyer are never read.
export const createOrderSchema = z.object({
  addressId: z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid id"),
});

export const idempotencyHeaderSchema = z.object({
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, "Must be 8 to 64 letters, digits, - or _")
    .optional(),
});
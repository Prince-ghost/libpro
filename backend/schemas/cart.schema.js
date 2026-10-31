import { z } from "zod";

// Only bookId is read. quantity, price, userId and anything else sent is stripped.
export const addCartItemSchema = z.object({
  bookId: z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid id"),
});
import { z } from "zod";
import { pageQuerySchema } from "./book.schema.js";

const MODERATION_STATES = ["pending", "approved", "rejected"];
const BOOK_STATUSES = ["active", "reserved", "sold", "archived"];
const ORDER_STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"];

export const adminBooksQuerySchema = pageQuerySchema.extend({
  moderationState: z.enum(MODERATION_STATES).optional(),
  status: z.enum(BOOK_STATUSES).optional(),
});

export const adminOrdersQuerySchema = pageQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

export const adminUsersQuerySchema = pageQuerySchema.extend({
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  email: z.string().trim().toLowerCase().max(254, "Email is too long").optional(), // exact match only
});

// An admin can approve or reject. Sending a listing back to "pending" is not offered.
export const moderateBookSchema = z
  .object({
    moderationState: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(500, "Reason must be at most 500 characters").optional(),
  })
  .refine((v) => v.moderationState !== "rejected" || (v.reason?.length ?? 0) >= 3, {
    message: "Please give a reason (at least 3 characters) when rejecting",
    path: ["reason"],
  });

// Only the status can be changed. Role changes are not possible through the API.
export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});
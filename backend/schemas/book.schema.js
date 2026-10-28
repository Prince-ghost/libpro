import { z } from "zod";

// Keep these lists in sync with models/Book.js.
export const AUDIENCES = ["school", "college", "competitive", "reference", "other"];
export const CONDITIONS = ["like_new", "good", "fair", "poor"];
export const SORT_KEYS = ["newest", "price_asc", "price_desc"];

const required = (label, max) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);
const optional = (max) => z.string().trim().max(max, `Must be at most ${max} characters`).optional();

// No defaults here on purpose: this schema is reused (as .partial()) for edits,
// and a default would silently overwrite fields the client did not send.
// Anything not listed (sellerId, status, moderationState...) is stripped.
export const createBookSchema = z.object({
  title: required("Title", 200),
  author: required("Author", 120),
  category: required("Category", 60),
  audience: z.enum(AUDIENCES),
  condition: z.enum(CONDITIONS),
  classOrCourse: optional(100),
  edition: optional(50),
  description: optional(2000),
  priceMinor: z
    .number()
    .int("Price must be a whole number of paise")
    .min(1, "Price must be at least 1 paisa")
    .max(10000000, "Price is too high"),
});

export const updateBookSchema = createBookSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

const page = z.coerce.number().int("Must be a whole number").min(1, "Must be at least 1").max(1000, "Must be at most 1000").default(1);
const limit = (max) =>
  z.coerce.number().int("Must be a whole number").min(1, "Must be at least 1").max(max, `Must be at most ${max}`).default(12);
const price = z.coerce.number().int("Must be a whole number").min(0, "Must not be negative").max(10000000, "Too high").optional();

export const pageQuerySchema = z.object({ page, limit: limit(50) });

export const browseQuerySchema = z
  .object({
    page,
    limit: limit(50),
    q: z.string().trim().max(100, "Search is too long").optional(),
    category: z.string().trim().min(1).max(60).optional(),
    audience: z.enum(AUDIENCES).optional(),
    condition: z.enum(CONDITIONS).optional(),
    minPrice: price,
    maxPrice: price,
    sort: z.enum(SORT_KEYS).default("newest"),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "minPrice must not be greater than maxPrice",
    path: ["minPrice"],
  });
import { z } from "zod";

const text = (label, max, min = 1) =>
  z
    .string()
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const phone = z
  .string()
  .trim()
  .max(20, "Phone number is too long")
  .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number")
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Enter a valid phone number");

// Loose on purpose: postal formats differ by country. India's stricter rule lives in the service.
const postalCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/, "Enter a valid postal code");

const country = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code")
  .transform((v) => v.toUpperCase());

export const createAddressSchema = z.object({
  recipientName: text("Recipient name", 80, 2),
  phone,
  line1: text("Address line 1", 120),
  line2: z.string().trim().max(120, "Address line 2 must be at most 120 characters").optional(),
  city: text("City", 60),
  state: text("State", 60),
  postalCode,
  country: country.optional(),
  isDefault: z.boolean().optional(),
});

// Edits can only turn the default ON; making another address the default turns this one off.
export const updateAddressSchema = createAddressSchema
  .omit({ isDefault: true })
  .partial()
  .extend({
    isDefault: z
      .boolean()
      .refine((v) => v === true, "Set another address as default instead")
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });
import "dotenv/config";
import { z } from "zod";

const mongoUri = z
  .string()
  .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(10),
    ORDER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(20),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    RAZORPAY_MODE: z.enum(["test", "live"]).default("test"),
    RAZORPAY_KEY_ID: z.string().min(1).optional(),
    RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    DEV_PASSWORD_RESET_LINKS: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    // Optional: without it, the Google sign-in route answers 503 and everything else keeps working.
    GOOGLE_CLIENT_ID: z
      .string()
      .regex(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/, "must look like xxxx.apps.googleusercontent.com")
      .optional(),
    MONGODB_URI: mongoUri.optional(),
    MONGODB_URI_TEST: mongoUri.optional(),
  })
  .superRefine((vars, ctx) => {
    const key = vars.NODE_ENV === "test" ? "MONGODB_URI_TEST" : "MONGODB_URI";
    if (!vars[key]) {
      ctx.addIssue({ code: "custom", path: [key], message: "Required" });
    }
    if (vars.NODE_ENV === "production" && !vars.CLIENT_ORIGIN.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["CLIENT_ORIGIN"], message: "Must use https in production" });
    }
    if (vars.NODE_ENV === "production" && !vars.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Required" });
    }
    if (vars.NODE_ENV === "production" && !vars.EMAIL_FROM) {
      ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Required" });
    }
    if (vars.NODE_ENV === "production" && !vars.RAZORPAY_KEY_ID) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Required" });
    }
    if (vars.NODE_ENV === "production" && !vars.RAZORPAY_KEY_SECRET) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_SECRET"], message: "Required" });
    }
    if (vars.RAZORPAY_KEY_ID) {
      const liveKey = vars.RAZORPAY_KEY_ID.startsWith("rzp_live_");
      const testKey = vars.RAZORPAY_KEY_ID.startsWith("rzp_test_");
      if (vars.RAZORPAY_MODE === "test" && !testKey) {
        ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Test mode requires an rzp_test_ key" });
      }
      if (vars.RAZORPAY_MODE === "live" && !liveKey) {
        ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Live mode requires an rzp_live_ key" });
      }
    }
    if (vars.NODE_ENV === "production" && vars.DEV_PASSWORD_RESET_LINKS) {
      ctx.addIssue({ code: "custom", path: ["DEV_PASSWORD_RESET_LINKS"], message: "Must be false in production" });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Invalid environment variables: ${fields}`);
  process.exit(1);
}

export const env = parsed.data;
export const dbUri = env.NODE_ENV === "test" ? env.MONGODB_URI_TEST : env.MONGODB_URI;
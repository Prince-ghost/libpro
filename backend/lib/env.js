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
    // How many reverse proxies sit in front of the app (0 = none). Needed for correct client IPs.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
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
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Invalid environment variables: ${fields}`);
  process.exit(1);
}

export const env = parsed.data;
export const dbUri = env.NODE_ENV === "test" ? env.MONGODB_URI_TEST : env.MONGODB_URI;
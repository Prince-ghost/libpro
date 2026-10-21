import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Names of bad variables only, never their values.
  const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Invalid environment variables: ${fields}`);
  process.exit(1);
}

export const env = parsed.data;
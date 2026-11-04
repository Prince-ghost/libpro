import { z } from "zod";

// A Google ID token is a long signed string. Nothing else in the body is read.
export const googleSignInSchema = z.object({
  credential: z.string().min(20, "Invalid token").max(4096, "Invalid token"),
});
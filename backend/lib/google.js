import { OAuth2Client } from "google-auth-library";
import { env } from "./env.js";
import { AppError } from "./http.js";

let client;

const failed = () => new AppError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in failed. Please try again.");

// Checks Google's signature, that the token was issued for THIS app (audience), the issuer and the
// expiry time. Only an email Google itself has verified is accepted.
export async function verifyGoogleIdToken(idToken) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not available.");
  }
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    // Never log the token itself.
    console.error(JSON.stringify({ level: "error", event: "google_verify_failed", name: err?.name }));
    throw failed();
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw failed();
  return { sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name ?? "" };
}
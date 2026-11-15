import { env } from "./env.js";
import { AppError } from "./http.js";

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Password reset is temporarily unavailable.");
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Reset your BookBack password",
        text: `Use this link to reset your BookBack password. It expires in 1 hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      }),
    });
  } catch {
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Password reset is temporarily unavailable.");
  }

  if (!response.ok) {
    console.error(JSON.stringify({ level: "error", event: "password_reset_email_failed", status: response.status }));
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Password reset is temporarily unavailable.");
  }
}

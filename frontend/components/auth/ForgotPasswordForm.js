"use client";

import { useState } from "react";
import Link from "next/link";
import FormField from "@/components/ui/FormField";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/api";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await api("/api/auth/forgot-password", { method: "POST", body: { email: value } });
      setSubmitted(result.data?.devResetUrl ?? null);
    } catch (err) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Alert tone="info">
          If an account exists for that email, a reset link has been sent.
          {submitted && (
            <span className="mt-2 block">
              Development reset link:{" "}
              <a href={submitted} className="break-all underline">
                Open reset link
              </a>
            </span>
          )}
        </Alert>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-brand underline">Return to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {error && <Alert>{error}</Alert>}
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error && !EMAIL_RE.test(email.trim()) ? error : undefined}
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand underline">Return to log in</Link>
      </p>
    </form>
  );
}

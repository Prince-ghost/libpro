"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FormField from "@/components/ui/FormField";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/api";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    if (!token) return setError("This password reset link is invalid or expired.");
    setError("");
    setSubmitting(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="info">Your password has been changed. Please log in.</Alert>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-brand underline">Go to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {error && <Alert>{error}</Alert>}
      <FormField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint="At least 8 characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <FormField
        id="confirmation"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Changing password…" : "Change password"}
      </button>
    </form>
  );
}

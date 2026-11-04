"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import FormField from "@/components/ui/FormField";
import Alert from "@/components/ui/Alert";
import { fieldErrorsFrom, focusFirstError } from "@/lib/form-errors";
import { safeNext } from "@/lib/redirect";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const FIELD_ORDER = ["email", "password"];

function validate(values) {
  const errors = {};
  const email = values.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Enter your password.";
  return errors;
}

export default function LoginForm() {
  const { status, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const justRegistered = params.get("registered") === "1";

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Someone who is already logged in has no reason to see this page.
  useEffect(() => {
    if (status === "authenticated" && !submitting) router.replace(next);
  }, [status, submitting, next, router]);

  function onChange(event) {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return; // ignore double clicks
    setFormError("");

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }

    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
      router.replace(next); // the button stays disabled until the page changes
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      setErrors(fields);
      setFormError(
        Object.keys(fields).length > 0
          ? "Please correct the highlighted fields."
          : err?.message ?? "Something went wrong. Please try again."
      );
      focusFirstError(fields, FIELD_ORDER);
      setSubmitting(false);
    }
  }

  const registerHref = next === "/" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {justRegistered && !formError && <Alert tone="info">Your account was created. Please log in.</Alert>}
      {formError && <Alert>{formError}</Alert>}

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        value={values.email}
        onChange={onChange}
        error={errors.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        value={values.password}
        onChange={onChange}
        error={errors.password}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      <p className="text-center text-sm text-muted">
        No account yet?{" "}
        <Link href={registerHref} className="font-medium text-brand underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
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
const FIELD_ORDER = ["name", "email", "password"];

function validate(values) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  else if (name.length > 80) errors.name = "Name must be at most 80 characters.";
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (values.password.length > 128) errors.password = "Password must be at most 128 characters.";
  return errors;
}

export default function RegisterForm() {
  const { status, register, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (submitting) return;
    setFormError("");

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }

    setSubmitting(true);
    const details = { name: values.name.trim(), email: values.email.trim(), password: values.password };

    try {
      await register(details);
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      if (err?.code === "EMAIL_TAKEN") fields.email = err.message;
      setErrors(fields);
      setFormError(
        Object.keys(fields).length > 0
          ? "Please correct the highlighted fields."
          : err?.message ?? "Something went wrong. Please try again."
      );
      focusFirstError(fields, FIELD_ORDER);
      setSubmitting(false);
      return;
    }

    try {
      await login(details.email, details.password);
      router.replace(next);
    } catch {
      // The account exists but the automatic login failed: let the person log in themselves.
      router.replace("/login?registered=1");
    }
  }

  const loginHref = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      {formError && <Alert>{formError}</Alert>}

      <FormField
        id="name"
        label="Name"
        type="text"
        autoComplete="name"
        maxLength={80}
        value={values.name}
        onChange={onChange}
        error={errors.name}
      />
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
        autoComplete="new-password"
        maxLength={128}
        hint="At least 8 characters."
        value={values.password}
        onChange={onChange}
        error={errors.password}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-brand underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
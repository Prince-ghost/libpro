"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import Alert from "@/components/ui/Alert";
import FormField from "@/components/ui/FormField";
import { fieldErrorsFrom, focusFirstError } from "@/lib/form-errors";

const LINKS = [
  { href: "/orders", title: "My orders", text: "Books you have bought, and their status." },
  { href: "/sales", title: "Orders for my books", text: "Orders that include books you have listed." },
  { href: "/my-listings", title: "My listings", text: "Your books for sale and their approval status." },
  { href: "/addresses", title: "My addresses", text: "Where your books are delivered." },
];

const PRIMARY =
  "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";
const PASSWORD_ORDER = ["currentPassword", "newPassword", "confirmPassword"];

function NameForm() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    const next = name.trim();
    if (next.length < 2 || next.length > 80) {
      setError("Your name must be between 2 and 80 characters.");
      document.getElementById("name")?.focus();
      return;
    }
    if (next === user.name) {
      setNotice("Your name is already saved like this.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api("/api/profile", { method: "PATCH", body: { name: next } });
      updateUser({ name: data.name });
      setName(data.name);
      setNotice("Your name was updated.");
    } catch (err) {
      setError(fieldErrorsFrom(err).name ?? err?.message ?? "Could not save your name. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
      {notice && <Alert tone="info">{notice}</Alert>}
      <FormField
        id="name"
        label="Name"
        type="text"
        autoComplete="name"
        maxLength={80}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError("");
        }}
        error={error}
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function onChange(event) {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    setNotice("");

    const found = {};
    if (!values.currentPassword) found.currentPassword = "Enter your current password.";
    if (values.newPassword.length < 8) found.newPassword = "The new password must be at least 8 characters.";
    else if (values.newPassword.length > 128) found.newPassword = "The new password must be at most 128 characters.";
    else if (values.newPassword === values.currentPassword) {
      found.newPassword = "The new password must be different from the current one.";
    }
    if (values.confirmPassword !== values.newPassword) found.confirmPassword = "The two new passwords do not match.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, PASSWORD_ORDER);
      return;
    }

    setBusy(true);
    try {
      await api("/api/profile/password", {
        method: "POST",
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice("Your password was changed. You were signed out of your other devices.");
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      if (err?.code === "INVALID_PASSWORD") fields.currentPassword = "Your current password is not correct.";
      setErrors(fields);
      setFormError(
        Object.keys(fields).length > 0
          ? "Please correct the highlighted fields."
          : err?.message ?? "Something went wrong. Please try again."
      );
      focusFirstError(fields, PASSWORD_ORDER);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
      {notice && <Alert tone="info">{notice}</Alert>}
      {formError && <Alert>{formError}</Alert>}
      <FormField
        id="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        value={values.currentPassword}
        onChange={onChange}
        error={errors.currentPassword}
      />
      <FormField
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint="At least 8 characters."
        value={values.newPassword}
        onChange={onChange}
        error={errors.newPassword}
      />
      <FormField
        id="confirmPassword"
        label="Repeat the new password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        value={values.confirmPassword}
        onChange={onChange}
        error={errors.confirmPassword}
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

export default function AccountView() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <section aria-labelledby="who-heading">
        <h2 id="who-heading" className="sr-only">
          Your account
        </h2>
        <p className="break-words text-lg font-medium">{user.name}</p>
        <p className="break-words text-muted">{user.email}</p>
        {user.role === "admin" && (
          <p className="mt-2 inline-block rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-sm font-medium text-brand-dark">
            Staff account
          </p>
        )}
      </section>

      <nav aria-label="Your pages">
        <ul className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block h-full rounded-2xl border border-line bg-surface p-4 hover:border-brand"
              >
                <span className="font-serif text-lg font-bold">{link.title}</span>
                <span className="mt-1 block text-sm text-muted">{link.text}</span>
              </Link>
            </li>
          ))}
          {user.role === "admin" && (
            <li>
              <Link href="/admin" className="block h-full rounded-2xl border border-line bg-surface p-4 hover:border-brand">
                <span className="font-serif text-lg font-bold">Admin</span>
                <span className="mt-1 block text-sm text-muted">Review listings, users and orders.</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <section aria-labelledby="name-heading" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="name-heading" className="font-serif text-xl font-bold">
          Your name
        </h2>
        <div className="mt-4">
          <NameForm />
        </div>
      </section>

      <section aria-labelledby="password-heading" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="password-heading" className="font-serif text-xl font-bold">
          Change password
        </h2>
        <p className="mt-2 text-sm text-muted">
          If you only ever signed in with Google, you do not have a BookBack password, so this form will not work for
          you. Changing your password signs you out of all your other devices.
        </p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
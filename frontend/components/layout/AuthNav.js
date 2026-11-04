"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AuthNav() {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await logout();
      router.push("/");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <div aria-hidden="true" className="h-9 w-28 animate-pulse rounded-lg bg-line" />;
  }

  if (status === "authenticated") {
    return (
      <nav aria-label="Account" className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Link href="/my-listings" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface">
          My listings
        </Link>
        <span className="hidden max-w-[10rem] truncate text-sm text-muted sm:inline" title={user.name}>
          {user.name}
        </span>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
        >
          {busy ? "Logging out…" : "Log out"}
        </button>
        {failed && (
          <span role="alert" className="text-xs text-danger">
            Could not log out. Try again.
          </span>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface">
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Sign up
      </Link>
    </nav>
  );
}
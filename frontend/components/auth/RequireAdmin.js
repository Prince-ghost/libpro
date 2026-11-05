"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

// A convenience only: the server checks the role again on every admin request.
export default function RequireAdmin({ children }) {
  const { status, user } = useAuth();
  if (status !== "authenticated") return null; // RequireAuth shows its own messages

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">You do not have access to this page</h2>
        <p className="mt-3 text-muted">This area is only for BookBack staff.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Go to the home page
        </Link>
      </div>
    );
  }
  return children;
}
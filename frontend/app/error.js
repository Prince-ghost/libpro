"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error }) {
  useEffect(() => {
    console.error(error); // visible to developers in the console, never shown on the page
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-muted">An unexpected error happened. Please try again.</p>
      {error?.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Reload page
        </button>
        <Link href="/" className="rounded-lg border border-line px-5 py-2.5 font-medium hover:bg-surface">
          Go home
        </Link>
      </div>
    </div>
  );
}
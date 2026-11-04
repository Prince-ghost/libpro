"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShop } from "@/components/shop/ShopProvider";
import Alert from "@/components/ui/Alert";

const PRIMARY =
  "inline-block rounded-lg bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

export default function CartActions({ book }) {
  const { status } = useAuth();
  const { cartHas, addToCart, removeFromCart } = useShop();
  const inCart = cartHas(book.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action(book.id);
    } catch (err) {
      // For example "You cannot buy your own listing." comes straight from the server.
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <div aria-hidden="true" className="h-11 w-40 animate-pulse rounded-lg bg-line" />;
  }

  if (status === "anonymous") {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/books/${book.id}`)}`} className={PRIMARY}>
        Log in to add to cart
      </Link>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-danger">Cannot reach the server. Refresh the page to try again.</p>;
  }

  return (
    <div>
      {inCart ? (
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className="font-medium text-brand-dark">
            In your cart
          </span>
          <Link href="/cart" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-paper">
            View cart
          </Link>
          <button
            type="button"
            onClick={() => run(removeFromCart)}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-danger underline disabled:opacity-60"
          >
            {busy ? "Removing…" : "Remove from cart"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => run(addToCart)} disabled={busy} className={PRIMARY}>
          {busy ? "Adding…" : "Add to cart"}
        </button>
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShop } from "@/components/shop/ShopProvider";
import Alert from "@/components/ui/Alert";

const PRIMARY =
  "inline-block rounded-lg bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

export default function CartActions({ book, compact = false }) {
  const router = useRouter();
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

  async function buyNow() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!inCart) await addToCart(book.id);
      router.push("/checkout");
    } catch (err) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <div aria-hidden="true" className="mt-3 h-10 w-full animate-pulse rounded-lg bg-line" />;
  }

  if (status === "anonymous") {
    const loginHref = `/login?next=${encodeURIComponent(`/books/${book.id}`)}`;
    return compact ? (
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Link href={loginHref} className={`${PRIMARY} px-1 py-1 text-center text-xs`}>
          Log in to cart
        </Link>
        <Link href={loginHref} className="rounded-lg border border-brand px-1 py-1 text-center text-xs font-medium text-brand hover:bg-paper">
          Buy now
        </Link>
      </div>
    ) : (
      <Link href={loginHref} className={PRIMARY}>
        Log in to add to cart
      </Link>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-danger">Cannot reach the server. Refresh the page to try again.</p>;
  }

  return (
    <div className={compact ? "mt-2" : ""}>
      {compact ? (
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => run(inCart ? removeFromCart : addToCart)}
            disabled={busy || book.status !== "active"}
            className="rounded-md border border-brand px-1 py-1 text-xs font-medium text-brand hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Please wait…" : inCart ? "Remove cart" : "Add to cart"}
          </button>
          <button
            type="button"
            onClick={buyNow}
            disabled={busy || book.status !== "active"}
            className="rounded-md bg-brand px-1 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Buy now"}
          </button>
        </div>
      ) : (
        inCart ? (
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="font-medium text-brand-dark">
              In your cart
            </span>
            <button type="button" onClick={buyNow} disabled={busy} className={PRIMARY}>
              {busy ? "Opening…" : "Buy now"}
            </button>
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
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => run(addToCart)} disabled={busy} className={PRIMARY}>
              {busy ? "Adding…" : "Add to cart"}
            </button>
            <button type="button" onClick={buyNow} disabled={busy} className="rounded-lg border border-brand px-6 py-2.5 font-medium text-brand hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Opening…" : "Buy now"}
            </button>
          </div>
        )
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShop } from "@/components/shop/ShopProvider";
import Alert from "@/components/ui/Alert";
import BookCover from "@/components/books/BookCover";
import { CONDITION_LABELS, formatPrice } from "@/lib/format";

const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";

export default function CartView() {
  const { cart, refreshCart, removeFromCart } = useShop();
  const [busyId, setBusyId] = useState("");
  const [errors, setErrors] = useState({});

  // Opening the cart asks the server again, so anything that was sold meanwhile drops out.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  async function remove(id) {
    if (busyId) return;
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      await removeFromCart(id);
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err?.message ?? "Could not remove this book. Please try again." }));
    } finally {
      setBusyId("");
    }
  }

  if (!cart.loaded) {
    if (cart.error) {
      return (
        <div className="space-y-3">
          <Alert>{cart.error.message}</Alert>
          <button type="button" onClick={refreshCart} className={BUTTON}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your cart…
      </p>
    );
  }

  const removedCount = cart.removed.length;

  return (
    <div>
      {cart.error && (
        <div className="mb-4">
          <Alert>Could not refresh your cart: {cart.error.message}</Alert>
        </div>
      )}
      {removedCount > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            {removedCount} {removedCount === 1 ? "book was" : "books were"} no longer available and{" "}
            {removedCount === 1 ? "was" : "were"} removed from your cart.
          </Alert>
        </div>
      )}

      {cart.count === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <h2 className="font-serif text-2xl font-bold">Your cart is empty</h2>
          <p className="mt-2 text-muted">Find a book you need and add it here.</p>
          <Link href="/books" className={`mt-5 inline-block ${BUTTON}`}>
            Browse books
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <ul className="space-y-3">
            {cart.items.map(({ book }) => (
              <li key={book.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <div className="w-20 shrink-0 sm:w-24">
                  <BookCover book={book} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-serif text-lg font-bold leading-snug">
                    <Link href={`/books/${encodeURIComponent(book.id)}`} className="hover:text-brand hover:underline">
                      {book.title}
                    </Link>
                  </h2>
                  <p className="break-words text-sm text-muted">by {book.author}</p>
                  <p className="mt-1 text-sm text-muted">
                    {CONDITION_LABELS[book.condition] ?? book.condition} · Sold by {book.seller?.name}
                  </p>
                  <p className="mt-2 text-lg font-bold text-brand-dark">{formatPrice(book.priceMinor)}</p>
                  <button
                    type="button"
                    onClick={() => remove(book.id)}
                    disabled={busyId !== ""}
                    className="mt-2 text-sm font-medium text-danger underline disabled:opacity-60"
                  >
                    {busyId === book.id ? "Removing…" : "Remove"}
                  </button>
                  {errors[book.id] && (
                    <p role="alert" className="mt-1 text-sm text-danger">
                      {errors[book.id]}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-serif text-xl font-bold">Summary</h2>
            <p className="mt-3 flex justify-between gap-3">
              <span>Items ({cart.count})</span>
              <span className="font-bold">{formatPrice(cart.subtotalMinor)}</span>
            </p>
            <p className="mt-4 text-sm text-muted">
              Prices here are for your information. Shipping and the final total are worked out when you check out, using
              the prices at that moment.
            </p>
            <Link href="/checkout" className={`mt-4 block text-center ${BUTTON}`}>
              Proceed to checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
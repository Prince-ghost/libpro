"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useShop } from "@/components/shop/ShopProvider";
import Alert from "@/components/ui/Alert";
import BookCard from "@/components/books/BookCard";

const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";

export default function WishlistView() {
  const { wishlist, refreshWishlist } = useShop();

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  if (!wishlist.loaded) {
    if (wishlist.error) {
      return (
        <div className="space-y-3">
          <Alert>{wishlist.error.message}</Alert>
          <button type="button" onClick={refreshWishlist} className={BUTTON}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your wishlist…
      </p>
    );
  }

  if (wishlist.count === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">Your wishlist is empty</h2>
        <p className="mt-2 text-muted">Tap the heart on a book to save it for later.</p>
        <Link href="/books" className={`mt-5 inline-block ${BUTTON}`}>
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div>
      {wishlist.error && (
        <div className="mb-4">
          <Alert>Could not refresh your wishlist: {wishlist.error.message}</Alert>
        </div>
      )}
      <p role="status" className="text-sm text-muted">
        {wishlist.count} saved {wishlist.count === 1 ? "book" : "books"}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {wishlist.items.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </ul>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AUDIENCE_LABELS, CONDITION_LABELS, formatDate, formatPrice } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import BookCover from "@/components/books/BookCover";
import CartActions from "@/components/shop/CartActions";
import WishlistButton from "@/components/shop/WishlistButton";

const ID_RE = /^[a-f\d]{24}$/i;
const MODERATION_TEXT = { pending: "waiting for approval", rejected: "not approved" };
const STATUS_TEXT = { active: "Available", reserved: "Reserved", sold: "Sold", archived: "Removed" };

function NotFoundView() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="font-serif text-3xl font-bold">Book not found</h1>
      <p className="mt-3 text-muted">This listing may have been removed, or the link may be wrong.</p>
      <Link
        href="/books"
        className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
      >
        Browse books
      </Link>
    </div>
  );
}

function Row({ label, children }) {
  if (!children) return null;
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </>
  );
}

export default function BookDetail({ id }) {
  const validId = ID_RE.test(id);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}#${attempt}`;
  const [result, setResult] = useState({ key: "", book: null, error: null });

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    api(`/api/books/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(({ data }) => setResult({ key: requestKey, book: data, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, book: null, error: err });
      });
    return () => controller.abort();
  }, [id, validId, requestKey]);

  if (!validId) return <NotFoundView />;

  if (result.key !== requestKey) {
    return (
      <p role="status" className="py-12 text-center text-muted">
        Loading book…
      </p>
    );
  }

  if (result.error) {
    // Missing, hidden and malformed all look the same, so nobody can probe for private listings.
    if (result.error.status === 404 || result.error.status === 400) return <NotFoundView />;
    return (
      <div className="mx-auto max-w-md space-y-3 py-12 text-center">
        <Alert>{result.error.message}</Alert>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  const book = result.book;
  const notices = [];
  if (book.moderationState && book.moderationState !== "approved") {
    notices.push(
      `Only you and BookBack staff can see this listing right now. It is ${
        MODERATION_TEXT[book.moderationState] ?? book.moderationState
      }.`
    );
  }
  if (book.status === "archived") notices.push("This listing has been removed and is no longer visible to other people.");
  if (book.status === "sold") notices.push("This book has been sold.");
  if (book.status === "reserved") notices.push("This book is reserved for another buyer.");

  // Only approved listings can go in a cart or wishlist. Owners and staff also get an approval
  // status back, and a listing that is not approved yet has no cart or wishlist buttons.
  const approved = book.moderationState === undefined || book.moderationState === "approved";
  const canBuy = approved && book.status === "active";
  const canSave = approved && book.status !== "archived";

  return (
    <article>
      <Link href="/books" className="text-sm font-medium text-brand underline">
        ← All books
      </Link>

      {notices.length > 0 && (
        <div className="mt-4 space-y-2">
          {notices.map((text) => (
            <Alert key={text} tone="info">
              {text}
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr]">
        <BookCover book={book} size="large" />

        <div className="min-w-0">
          <h1 className="break-words font-serif text-3xl font-bold leading-tight">{book.title}</h1>
          <p className="mt-1 break-words text-lg text-muted">by {book.author}</p>

          <p className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-brand-dark">{formatPrice(book.priceMinor)}</span>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium">
              {STATUS_TEXT[book.status] ?? book.status}
            </span>
          </p>

          {(canBuy || canSave) && (
            <div className="mt-5 flex flex-wrap items-start gap-3">
              {canBuy && <CartActions book={book} />}
              {canSave && <WishlistButton book={book} />}
            </div>
          )}

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="Condition">{CONDITION_LABELS[book.condition] ?? book.condition}</Row>
            <Row label="Suitable for">{AUDIENCE_LABELS[book.audience] ?? book.audience}</Row>
            <Row label="Class or course">{book.classOrCourse}</Row>
            <Row label="Edition">{book.edition}</Row>
            <Row label="Category">{book.category}</Row>
            <Row label="Seller">{book.seller?.name}</Row>
            <Row label="Listed">{formatDate(book.createdAt)}</Row>
          </dl>

          <h2 className="mt-8 font-serif text-xl font-bold">Description</h2>
          {book.description ? (
            <p className="mt-2 whitespace-pre-line break-words">{book.description}</p>
          ) : (
            <p className="mt-2 text-muted">The seller has not added a description.</p>
          )}
        </div>
      </div>
    </article>
  );
}
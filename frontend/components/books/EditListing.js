"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Alert from "@/components/ui/Alert";
import BookForm from "@/components/books/BookForm";

const ID_RE = /^[a-f\d]{24}$/i;

const LOCKED_TEXT = {
  reserved: "This book is reserved for a buyer, so it can no longer be edited.",
  sold: "This book has been sold, so it can no longer be edited.",
  archived: "This listing has been removed, so it can no longer be edited.",
};
const NOTICE_TEXT = {
  approved:
    "This listing is live. Saving changes sends it back for approval, and it will be hidden from other people until it is approved again.",
  pending: "This listing is waiting for approval. Saving changes keeps it waiting.",
  rejected: "This listing was not approved. Make your changes and save to send it for review again.",
};

function Message({ title, children }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="mt-3 text-muted">{children}</p>
      <Link
        href="/my-listings"
        className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
      >
        Back to my listings
      </Link>
    </div>
  );
}

export default function EditListing({ id }) {
  const router = useRouter();
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

  if (!validId) return <Message title="Listing not found">The link may be wrong.</Message>;

  if (result.key !== requestKey) {
    return (
      <p role="status" className="py-12 text-center text-muted">
        Loading listing…
      </p>
    );
  }

  if (result.error) {
    if (result.error.status === 404 || result.error.status === 400) {
      return <Message title="Listing not found">It may have been removed, or the link may be wrong.</Message>;
    }
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
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

  // Only an owner (or an admin) gets the approval status back. Everyone else gets the public view.
  if (book.moderationState === undefined) {
    return <Message title="Not your listing">You can only edit your own listings.</Message>;
  }
  if (book.status !== "active") {
    return (
      <Message title="This listing cannot be edited">
        {LOCKED_TEXT[book.status] ?? "This listing can no longer be edited."}
      </Message>
    );
  }

  async function save(patch) {
    await api(`/api/books/${encodeURIComponent(book.id)}`, { method: "PATCH", body: patch });
    router.push("/my-listings?updated=1");
  }

  return (
    <BookForm
      book={book}
      onSubmit={save}
      submitLabel="Save changes"
      busyLabel="Saving…"
      cancelHref="/my-listings"
      notice={`${NOTICE_TEXT[book.moderationState] ?? ""}${
        book.moderationState === "rejected" && book.moderationNote ? ` Reason given: ${book.moderationNote}` : ""
      }`}    />
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AUDIENCE_LABELS, formatDate, formatPrice } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";

const PAGE_SIZE = 12;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const SMALL = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper";

const LIVE = "border-brand/30 bg-brand/5 text-brand-dark";
const WAITING = "border-amber-300 bg-amber-50 text-amber-900";
const REJECTED = "border-danger/30 bg-danger/5 text-danger";
const NEUTRAL = "border-line bg-paper text-muted";

const NOTICES = {
  created: "Your listing was submitted. It will appear on BookBack once it has been approved.",
  updated: "Your changes were saved. The listing is waiting for approval again.",
};

// The status is always written out in words, never shown by colour alone.
function statusOf(book) {
  if (book.status === "sold") {
    return { label: "Sold", help: "This book has been sold. It cannot be edited or removed.", style: NEUTRAL };
  }
  if (book.status === "reserved") {
    return {
      label: "Reserved",
      help: "A buyer has started an order for this book, so it cannot be edited or removed right now.",
      style: NEUTRAL,
    };
  }
  if (book.moderationState === "pending") {
    return { label: "Waiting for approval", help: "Only you can see this listing until it has been approved.", style: WAITING };
  }
  if (book.moderationState === "rejected") {
    return { label: "Not approved", help: "Edit the listing and save it to send it for review again.", style: REJECTED };
  }
  return { label: "Live", help: "Everyone can see and search for this listing.", style: LIVE };
}

function pageFrom(value) {
  const n = /^\d{1,4}$/.test(value ?? "") ? Number(value) : 1;
  return n >= 1 && n <= 1000 ? n : 1;
}

function SkeletonList() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading your listings…
      </p>
      <ul aria-hidden="true" className="mt-4 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="animate-pulse rounded-2xl border border-line bg-surface p-4">
            <div className="h-5 w-1/2 rounded bg-line" />
            <div className="mt-2 h-4 w-1/3 rounded bg-line" />
            <div className="mt-4 h-6 w-1/4 rounded-full bg-line" />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function MyListings() {
  const router = useRouter();
  const params = useSearchParams();
  const page = pageFrom(params.get("page"));

  // The success message comes from the address the first time the page opens.
  const [notice, setNotice] = useState(() =>
    params.get("created") === "1" ? NOTICES.created : params.get("updated") === "1" ? NOTICES.updated : ""
  );
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${page}#${attempt}`;
  const [result, setResult] = useState({ key: "", items: [], meta: null, error: null });
  const [confirmingId, setConfirmingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  // Take the one-time flag out of the address, so a refresh does not show the message again.
  useEffect(() => {
    if (params.get("created") || params.get("updated")) router.replace("/my-listings", { scroll: false });
  }, [params, router]);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/books/mine?page=${page}&limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key: requestKey, items: data, meta, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, items: [], meta: null, error: err });
      });
    return () => controller.abort();
  }, [page, requestKey]);

  async function remove(id) {
    setBusyId(id);
    setActionError("");
    try {
      await api(`/api/books/${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmingId("");
      setNotice("The listing was removed.");
      setAttempt((n) => n + 1);
    } catch (err) {
      setActionError(err?.message ?? "Could not remove the listing. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  const loading = result.key !== requestKey;
  const meta = result.meta;
  const hrefFor = (p) => (p > 1 ? `/my-listings?page=${p}` : "/my-listings");

  let body;
  if (loading && !meta) {
    body = <SkeletonList />;
  } else if (!loading && result.error) {
    body = (
      <div className="mt-4 space-y-3">
        <Alert>{result.error.message}</Alert>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  } else if (!loading && meta.total === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">You have not listed any books yet</h2>
        <p className="mt-2 text-muted">Books you no longer need can help another student.</p>
        <Link href="/sell" className={`mt-5 inline-block ${BUTTON}`}>
          Sell a book
        </Link>
      </div>
    );
  } else if (!loading && result.items.length === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No listings on this page</h2>
        <Link href="/my-listings" className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
          {result.items.map((book) => {
            const info = statusOf(book);
            const active = book.status === "active";
            const confirming = confirmingId === book.id;
            const busy = busyId === book.id;
            return (
              <li key={book.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words font-serif text-lg font-bold leading-snug">
                      <Link href={`/books/${encodeURIComponent(book.id)}`} className="hover:text-brand hover:underline">
                        {book.title}
                      </Link>
                    </h2>
                    <p className="break-words text-sm text-muted">by {book.author}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatPrice(book.priceMinor)} · {AUDIENCE_LABELS[book.audience] ?? book.audience} · Listed{" "}
                      {formatDate(book.createdAt)}
                    </p>
                    <p className="mt-3">
                      <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${info.style}`}>
                        {info.label}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted">{info.help}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`/books/${encodeURIComponent(book.id)}`} className={SMALL}>
                      View
                    </Link>
                    {active && (
                      <Link href={`/my-listings/${encodeURIComponent(book.id)}/edit`} className={SMALL}>
                        Edit
                      </Link>
                    )}
                    {active && !confirming && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setConfirmingId(book.id);
                        }}
                        className={`${SMALL} text-danger`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {confirming && (
                  <div role="group" aria-label="Confirm removal" className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
                    <p className="text-sm">Remove this listing? It will no longer appear on BookBack.</p>
                    {actionError && (
                      <p role="alert" className="mt-1 text-sm text-danger">
                        {actionError}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => remove(book.id)}
                        disabled={busy}
                        className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {busy ? "Removing…" : "Yes, remove it"}
                      </button>
                      <button type="button" onClick={() => setConfirmingId("")} disabled={busy} className={SMALL}>
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <PageNav page={page} totalPages={meta.totalPages} hrefFor={hrefFor} />
      </>
    );
  }

  return (
    <div aria-busy={loading}>
      {notice && (
        <div className="mb-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}
      {meta && !result.error && meta.total > 0 && (
        <p role="status" className="text-sm text-muted">
          {meta.total} {meta.total === 1 ? "listing" : "listings"}
        </p>
      )}
      {body}
    </div>
  );
}
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApiList } from "@/lib/use-api-list";
import { buildHref, readChoice, readPage } from "@/lib/url-params";
import { MODERATION } from "@/lib/admin-labels";
import { imageUrl } from "@/lib/images";
import { AUDIENCE_LABELS, CONDITION_LABELS, formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";
import SelectField from "@/components/ui/SelectField";
import TextAreaField from "@/components/ui/TextAreaField";

const PAGE_SIZE = 12;
const STATES = ["pending", "approved", "rejected", "all"];
const STATE_LABELS = { pending: "Waiting for approval", approved: "Approved", rejected: "Not approved", all: "All listings" };
const STATUS_TEXT = { active: "Available", reserved: "Reserved", sold: "Sold", archived: "Removed" };
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const SMALL = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60";
const FALLBACK = "border-line bg-paper text-muted";

export default function AdminListings() {
  const router = useRouter();
  const params = useSearchParams();
  const state = readChoice(params.get("state"), STATES, "pending");
  const page = readPage(params.get("page"));

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (state !== "all") query.set("moderationState", state);
  const { loading, items, meta, error, reload } = useApiList(`/api/admin/books?${query}`);

  const [notice, setNotice] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  const hrefFor = (p) => buildHref("/admin/listings", { state: state !== "pending" ? state : "", page: p > 1 ? p : "" });

  async function decide(book, moderationState, reasonText) {
    setBusyId(book.id);
    setActionError("");
    try {
      const body = reasonText ? { moderationState, reason: reasonText } : { moderationState };
      await api(`/api/admin/books/${encodeURIComponent(book.id)}`, { method: "PATCH", body });
      setRejectingId("");
      setReason("");
      setNotice(`${moderationState === "approved" ? "Approved" : "Rejected"} "${book.title}".`);
      reload();
    } catch (err) {
      setActionError(err?.message ?? "Could not save the decision. Please try again.");
      if (err?.status === 409) reload(); // someone changed the listing: show the latest version
    } finally {
      setBusyId("");
    }
  }

  function submitReject(event, book) {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 3) {
      setReasonError("Give a reason of at least 3 characters.");
      return;
    }
    decide(book, "rejected", text);
  }

  let body;
  if (loading && !meta) {
    body = (
      <p role="status" className="py-8 text-center text-muted">
        Loading listings…
      </p>
    );
  } else if (!loading && error) {
    body = (
      <div className="mt-4 space-y-3">
        <Alert>{error.message}</Alert>
        <button type="button" onClick={reload} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  } else if (!loading && meta.total === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">
          {state === "pending" ? "Nothing is waiting for approval" : "No listings here"}
        </h2>
        <p className="mt-2 text-muted">
          {state === "pending" ? "New listings will appear here for review." : "Try a different filter."}
        </p>
      </div>
    );
  } else if (!loading && items.length === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No listings on this page</h2>
        <Link href={buildHref("/admin/listings", { state: state !== "pending" ? state : "" })} className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
          {items.map((book) => {
            const moderation = MODERATION[book.moderationState] ?? { label: book.moderationState, style: FALLBACK };
            const busy = busyId === book.id;
            const rejecting = rejectingId === book.id;
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
                      {formatPrice(book.priceMinor)} · {book.category} · {AUDIENCE_LABELS[book.audience] ?? book.audience} ·{" "}
                      {CONDITION_LABELS[book.condition] ?? book.condition}
                    </p>
                    <p className="text-sm text-muted">
                      Seller: {book.seller?.name ?? "Unknown"} · Listed {formatDateTime(book.createdAt)} ·{" "}
                      {STATUS_TEXT[book.status] ?? book.status}
                    </p>
                    <p className="mt-2">
                      <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${moderation.style}`}>
                        {moderation.label}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`/books/${encodeURIComponent(book.id)}`} className={SMALL}>
                      Open listing
                    </Link>
                    {book.moderationState !== "approved" && (
                      <button type="button" onClick={() => decide(book, "approved")} disabled={busyId !== ""} className={SMALL}>
                        {busy && !rejecting ? "Saving…" : "Approve"}
                      </button>
                    )}
                    {book.moderationState !== "rejected" && !rejecting && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setReasonError("");
                          setReason("");
                          setRejectingId(book.id);
                        }}
                        disabled={busyId !== ""}
                        className={`${SMALL} text-danger`}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>

                {book.images?.length > 0 && (
                  <ul aria-label="Photos" className="mt-3 flex flex-wrap gap-2">
                    {book.images.map((imageId, index) => (
                      <li key={imageId}>
                        <a href={imageUrl(imageId)} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                                   <img
                            src={imageUrl(imageId, "thumb")}
                            alt={`Photo ${index + 1} of ${book.title}`}
                            loading="lazy"
                            className="h-24 w-20 rounded-lg border border-line object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {rejecting && (
                  <form
                    onSubmit={(event) => submitReject(event, book)}
                    noValidate
                    className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3"
                  >
                    <TextAreaField
                      id={`reason-${book.id}`}
                      label="Why is this listing being rejected?"
                      rows={3}
                      maxLength={500}
                      hint="At least 3 characters. The seller will see this reason, so be specific and polite. It is also saved in the audit log."                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setReasonError("");
                      }}
                      error={reasonError}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {busy ? "Saving…" : "Reject listing"}
                      </button>
                      <button type="button" onClick={() => setRejectingId("")} disabled={busy} className={SMALL}>
                        Cancel
                      </button>
                    </div>
                  </form>
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
      {actionError && (
        <div className="mb-4">
          <Alert>{actionError}</Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <SelectField
            id="state"
            label="Show"
            value={state}
            onChange={(event) =>
              router.push(buildHref("/admin/listings", { state: event.target.value !== "pending" ? event.target.value : "" }))
            }
          >
            {STATES.map((value) => (
              <option key={value} value={value}>
                {STATE_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>
        {meta && !error && (
          <p role="status" className="text-sm text-muted">
            {meta.total} {meta.total === 1 ? "listing" : "listings"}, oldest first
          </p>
        )}
      </div>
      {body}
    </div>
  );
}
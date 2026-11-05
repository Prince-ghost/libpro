"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApiList } from "@/lib/use-api-list";
import { readPage } from "@/lib/url-params";
import { AUDIT_ACTIONS } from "@/lib/admin-labels";
import { formatDateTime } from "@/lib/datetime";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";

const PAGE_SIZE = 20;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const shortId = (id) => String(id).slice(0, 8);

// Only the fields our own code writes are shown, always as plain text.
function detailsText(details) {
  const parts = [];
  if (typeof details?.from === "string" && typeof details?.to === "string") parts.push(`${details.from} to ${details.to}`);
  if (typeof details?.reason === "string" && details.reason) parts.push(`Reason: ${details.reason}`);
  return parts.join(". ");
}

export default function AdminAudit() {
  const page = readPage(useSearchParams().get("page"));
  const { loading, items, meta, error, reload } = useApiList(`/api/admin/audit?page=${page}&limit=${PAGE_SIZE}`);
  const hrefFor = (p) => (p > 1 ? `/admin/audit?page=${p}` : "/admin/audit");

  if (loading && !meta) {
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading the audit log…
      </p>
    );
  }
  if (!loading && error) {
    return (
      <div className="space-y-3">
        <Alert>{error.message}</Alert>
        <button type="button" onClick={reload} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  }
  if (!loading && meta.total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">Nothing has been recorded yet</h2>
        <p className="mt-2 text-muted">Moderation and account decisions will appear here.</p>
      </div>
    );
  }
  if (!loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No entries on this page</h2>
        <Link href="/admin/audit" className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  }

  return (
    <div aria-busy={loading}>
      <p role="status" className="text-sm text-muted">
        {meta.total} {meta.total === 1 ? "entry" : "entries"}, newest first. Entries cannot be edited or deleted.
      </p>
      <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
        {items.map((event) => {
          const detail = detailsText(event.details);
          return (
            <li key={event.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-medium">{AUDIT_ACTIONS[event.action] ?? event.action}</p>
              <p className="text-sm text-muted">
                {formatDateTime(event.createdAt)} ·{" "}
                {event.actorId ? `Admin ${shortId(event.actorId)}` : "Command line"}
              </p>
              <p className="mt-1 text-sm">
                {event.targetType === "book" ? (
                  <>
                    Listing{" "}
                    <Link href={`/books/${encodeURIComponent(event.targetId)}`} className="font-mono text-brand underline">
                      {shortId(event.targetId)}
                    </Link>
                  </>
                ) : (
                  <>
                    Account <span className="font-mono">{shortId(event.targetId)}</span>
                  </>
                )}
              </p>
              {detail && <p className="mt-1 break-words text-sm text-muted">{detail}</p>}
            </li>
          );
        })}
      </ul>
      <PageNav page={page} totalPages={meta.totalPages} hrefFor={hrefFor} />
    </div>
  );
}
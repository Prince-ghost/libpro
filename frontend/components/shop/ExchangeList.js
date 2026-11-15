"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/api";

const LABELS = { pending: "Pending", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled" };

function RequestCard({ request, received, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function update(status) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/exchanges/${request.id}`, { method: "PATCH", body: { status } });
      onChange();
    } catch (err) {
      setError(err?.message ?? "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">
            {request.requestedBook?.title ?? "Book listing"}
          </h2>
          <p className="text-sm text-muted">
            {received ? `From ${request.requester?.name ?? "BookBack user"}` : `To ${request.owner?.name ?? "BookBack user"}`}
          </p>
        </div>
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-sm font-medium">
          {LABELS[request.status] ?? request.status}
        </span>
      </div>
      {request.message && <p className="mt-3 whitespace-pre-line text-sm">{request.message}</p>}
      {request.status === "accepted" && (
        <p className="mt-3 rounded-lg bg-brand/5 p-3 text-sm text-brand-dark">
          The request was accepted. Contact each other and arrange the handoff manually.
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {received && request.status === "pending" && (
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={() => update("accepted")} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Accept
          </button>
          <button type="button" disabled={busy} onClick={() => update("rejected")} className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60">
            Reject
          </button>
        </div>
      )}
      <Link href={`/books/${encodeURIComponent(request.requestedBook?.id ?? "")}`} className="mt-3 inline-block text-sm font-medium text-brand underline">
        View book
      </Link>
    </li>
  );
}

function RequestSection({ title, received }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/exchanges/${received ? "received" : "mine"}?page=1&limit=50`, { signal: controller.signal })
      .then(({ data }) => {
        setItems(data ?? []);
        setError("");
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Could not load exchange requests.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [received, attempt]);

  return (
    <section>
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      {loading && <p role="status" className="mt-3 text-muted">Loading…</p>}
      {!loading && error && <Alert>{error}</Alert>}
      {!loading && !error && items.length === 0 && <p className="mt-3 text-muted">No exchange requests yet.</p>}
      {!loading && !error && items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <RequestCard key={item.id} request={item} received={received} onChange={() => setAttempt((value) => value + 1)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ExchangeList() {
  return (
    <div className="space-y-10">
      <RequestSection title="Requests I sent" received={false} />
      <RequestSection title="Requests for my books" received />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import Alert from "@/components/ui/Alert";
import { api } from "@/lib/api";

export default function ExchangeRequestForm({ book }) {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  if (status !== "authenticated") {
    return (
      <Link href="/login?next=/books" className="rounded-lg border border-brand px-4 py-2.5 font-medium text-brand hover:bg-brand/5">
        Log in to request exchange
      </Link>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      await api("/api/exchanges", {
        method: "POST",
        body: { requestedBookId: book.id, message: message.trim() },
      });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err?.message ?? "Could not send the exchange request.");
    }
  }

  if (state === "sent") {
    return <Alert tone="info">Exchange request sent. You can track it from Exchange requests.</Alert>;
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-brand px-4 py-2.5 font-medium text-brand hover:bg-brand/5"
        >
          Request exchange
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-line bg-paper p-4">
          {error && <Alert>{error}</Alert>}
          <label htmlFor="exchange-message" className="block text-sm font-medium">
            Message to the seller (optional)
          </label>
          <textarea
            id="exchange-message"
            value={message}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell the seller what you would like to offer."
            className="mt-1 block min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" disabled={state === "sending"} className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

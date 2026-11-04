"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAddresses } from "@/components/shop/useAddresses";
import AddressForm from "@/components/shop/AddressForm";
import AddressText from "@/components/shop/AddressText";
import Alert from "@/components/ui/Alert";

const MAX_ADDRESSES = 10;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const SMALL = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60";

export default function AddressesView() {
  const { loaded, items, error, reload } = useAddresses();
  const [mode, setMode] = useState(null); // null, "new", or the id of the address being edited
  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  async function create(payload) {
    await api("/api/addresses", { method: "POST", body: payload });
    setMode(null);
    setNotice("Address added.");
    reload();
  }

  async function update(id, payload) {
    await api(`/api/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
    setMode(null);
    setNotice("Address saved.");
    reload();
  }

  async function makeDefault(id) {
    setBusyId(id);
    setActionError("");
    try {
      await api(`/api/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: { isDefault: true } });
      setNotice("Default address changed.");
      reload();
    } catch (err) {
      setActionError(err?.message ?? "Could not change the default address.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id) {
    setBusyId(id);
    setActionError("");
    try {
      await api(`/api/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmingId("");
      setNotice("Address removed.");
      reload();
    } catch (err) {
      setActionError(err?.message ?? "Could not remove the address. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  if (!loaded) {
    if (error) {
      return (
        <div className="space-y-3">
          <Alert>{error.message}</Alert>
          <button type="button" onClick={reload} className={BUTTON}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your addresses…
      </p>
    );
  }

  const editing = items.find((a) => a.id === mode) ?? null;
  const atLimit = items.length >= MAX_ADDRESSES;

  return (
    <div>
      {notice && (
        <div className="mb-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert>Could not refresh your addresses: {error.message}</Alert>
        </div>
      )}

      {items.length === 0 && mode !== "new" ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <h2 className="font-serif text-2xl font-bold">No saved addresses</h2>
          <p className="mt-2 text-muted">Add the address where you would like your books delivered.</p>
          <button type="button" onClick={() => setMode("new")} className={`mt-5 ${BUTTON}`}>
            Add an address
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((address) => {
            const isEditing = mode === address.id;
            const confirming = confirmingId === address.id;
            const busy = busyId === address.id;
            return (
              <li key={address.id} className="rounded-2xl border border-line bg-surface p-4">
                {isEditing ? (
                  <div>
                    <h2 className="mb-3 font-serif text-lg font-bold">Edit address</h2>
                    <AddressForm
                      key={address.id}
                      address={address}
                      canSetDefault={!address.isDefault}
                      onSubmit={(payload) => update(address.id, payload)}
                      onCancel={() => setMode(null)}
                      submitLabel="Save address"
                      busyLabel="Saving…"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <AddressText address={address} />
                        {address.isDefault && (
                          <span className="mt-2 inline-block rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand-dark">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNotice("");
                            setMode(address.id);
                          }}
                          className={SMALL}
                        >
                          Edit
                        </button>
                        {!address.isDefault && (
                          <button type="button" onClick={() => makeDefault(address.id)} disabled={busy} className={SMALL}>
                            Make default
                          </button>
                        )}
                        {!confirming && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionError("");
                              setConfirmingId(address.id);
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
                        <p className="text-sm">
                          Remove this address? Orders you already placed keep the address they were sent to.
                        </p>
                        {actionError && (
                          <p role="alert" className="mt-1 text-sm text-danger">
                            {actionError}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => remove(address.id)}
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {actionError && !confirmingId && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {actionError}
        </p>
      )}

      {mode === "new" ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-serif text-lg font-bold">New address</h2>
          <AddressForm
            key="new"
            canSetDefault={items.length > 0}
            onSubmit={create}
            onCancel={() => setMode(null)}
            submitLabel="Save address"
            busyLabel="Saving…"
          />
        </div>
      ) : (
        items.length > 0 &&
        (atLimit ? (
          <p className="mt-4 text-sm text-muted">
            You can save up to {MAX_ADDRESSES} addresses. Remove one to add another.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setMode("new");
            }}
            className={`mt-4 ${BUTTON}`}
          >
            Add a new address
          </button>
        ))
      )}
    </div>
  );
}
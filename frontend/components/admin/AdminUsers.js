"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApiList } from "@/lib/use-api-list";
import { buildHref, readChoice, readPage } from "@/lib/url-params";
import { ROLE_LABELS, USER_STATUS } from "@/lib/admin-labels";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/components/auth/AuthProvider";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";
import SelectField from "@/components/ui/SelectField";

const PAGE_SIZE = 15;
const ROLES = ["all", "user", "admin"];
const STATUSES = ["all", "active", "disabled"];
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const SMALL = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60";
const FALLBACK = "border-line bg-paper text-muted";

export default function AdminUsers() {
  const router = useRouter();
  const params = useSearchParams();
  const { user: me } = useAuth();
  const role = readChoice(params.get("role"), ROLES, "all");
  const status = readChoice(params.get("status"), STATUSES, "all");
  const email = (params.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const page = readPage(params.get("page"));

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (role !== "all") query.set("role", role);
  if (status !== "all") query.set("status", status);
  if (email) query.set("email", email);
  const { loading, items, meta, error, reload } = useApiList(`/api/admin/users?${query}`);

  // The search box follows the address (back button, Clear filters).
  const [draft, setDraft] = useState(email);
  const [synced, setSynced] = useState(email);
  if (synced !== email) {
    setSynced(email);
    setDraft(email);
  }

  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  const link = (overrides) =>
    buildHref("/admin/users", {
      role: role !== "all" ? role : "",
      status: status !== "all" ? status : "",
      email,
      page: "",
      ...overrides,
    });
  const filtersActive = role !== "all" || status !== "all" || Boolean(email);

  async function setStatus(account, next) {
    setBusyId(account.id);
    setActionError("");
    try {
      await api(`/api/admin/users/${encodeURIComponent(account.id)}`, { method: "PATCH", body: { status: next } });
      setConfirmingId("");
      setNotice(`${next === "disabled" ? "Disabled" : "Enabled"} the account of ${account.name}.`);
      reload();
    } catch (err) {
      setActionError(err?.message ?? "Could not change the account. Please try again.");
      if (err?.status === 409) reload();
    } finally {
      setBusyId("");
    }
  }

  function search(event) {
    event.preventDefault();
    router.push(link({ email: draft.trim().toLowerCase().slice(0, 254), page: "" }));
  }

  let body;
  if (loading && !meta) {
    body = (
      <p role="status" className="py-8 text-center text-muted">
        Loading users…
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
        <h2 className="font-serif text-2xl font-bold">No users found</h2>
        <p className="mt-2 text-muted">Try different filters. The email search needs the whole address.</p>
      </div>
    );
  } else if (!loading && items.length === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No users on this page</h2>
        <Link href={link({})} className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
          {items.map((account) => {
            const accountStatus = USER_STATUS[account.status] ?? { label: account.status, style: FALLBACK };
            const isMe = account.id === me?.id;
            const confirming = confirmingId === account.id;
            const busy = busyId === account.id;
            return (
              <li key={account.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words font-serif text-lg font-bold leading-snug">
                      {account.name}
                      {isMe && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}
                    </h2>
                    <p className="break-words text-sm text-muted">{account.email}</p>
                    <p className="text-sm text-muted">Joined {formatDate(account.createdAt)}</p>
                    <p className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-block rounded-full border border-line bg-paper px-3 py-1 text-sm font-medium">
                        {ROLE_LABELS[account.role] ?? account.role}
                      </span>
                      <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${accountStatus.style}`}>
                        {accountStatus.label}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    {account.role !== "user" || isMe ? (
                      <p className="max-w-[14rem] text-sm text-muted sm:text-right">
                        {isMe ? "This is your own account." : "Admin accounts cannot be changed here."}
                      </p>
                    ) : account.status === "active" ? (
                      !confirming && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");
                            setConfirmingId(account.id);
                          }}
                          className={`${SMALL} text-danger`}
                        >
                          Disable account
                        </button>
                      )
                    ) : (
                      <button type="button" onClick={() => setStatus(account, "active")} disabled={busyId !== ""} className={SMALL}>
                        {busy ? "Saving…" : "Enable account"}
                      </button>
                    )}
                  </div>
                </div>

                {confirming && (
                  <div role="group" aria-label="Confirm disabling" className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
                    <p className="text-sm">
                      Disable this account? The person will be logged out straight away and cannot log in until you enable
                      it again.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus(account, "disabled")}
                        disabled={busy}
                        className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {busy ? "Disabling…" : "Yes, disable it"}
                      </button>
                      <button type="button" onClick={() => setConfirmingId("")} disabled={busy} className={SMALL}>
                        Keep it active
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <PageNav page={page} totalPages={meta.totalPages} hrefFor={(p) => link({ page: p > 1 ? p : "" })} />
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

      <form onSubmit={search} className="flex max-w-xl gap-2">
        <div className="flex-1">
          <label htmlFor="user-email" className="sr-only">
            Find an account by its full email address
          </label>
          <input
            id="user-email"
            type="search"
            maxLength={254}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Find by full email address"
            className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
          />
        </div>
        <button type="submit" className={BUTTON}>
          Search
        </button>
      </form>

      <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <SelectField
          id="role"
          label="Role"
          value={role}
          onChange={(event) => router.push(link({ role: event.target.value !== "all" ? event.target.value : "" }))}
        >
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : ROLE_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="status"
          label="Status"
          value={status}
          onChange={(event) => router.push(link({ status: event.target.value !== "all" ? event.target.value : "" }))}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : USER_STATUS[value].label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {meta && !error && (
          <p role="status" className="text-sm text-muted">
            {meta.total} {meta.total === 1 ? "user" : "users"}
          </p>
        )}
        {filtersActive && (
          <Link href="/admin/users" className="text-sm font-medium text-brand underline">
            Clear filters
          </Link>
        )}
      </div>
      {body}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { PAYMENT_STATUS, orderStatusOf } from "@/lib/order-labels";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";

const PAGE_SIZE = 10;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";

function pageFrom(value) {
  const n = /^\d{1,4}$/.test(value ?? "") ? Number(value) : 1;
  return n >= 1 && n <= 1000 ? n : 1;
}

export default function OrdersList() {
  const page = pageFrom(useSearchParams().get("page"));
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${page}#${attempt}`;
  const [result, setResult] = useState({ key: "", items: [], meta: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/orders?page=${page}&limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key: requestKey, items: data, meta, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, items: [], meta: null, error: err });
      });
    return () => controller.abort();
  }, [page, requestKey]);

  const loading = result.key !== requestKey;
  const meta = result.meta;
  const hrefFor = (p) => (p > 1 ? `/orders?page=${p}` : "/orders");

  if (loading && !meta) {
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your orders…
      </p>
    );
  }
  if (!loading && result.error) {
    return (
      <div className="space-y-3">
        <Alert>{result.error.message}</Alert>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  }
  if (!loading && meta.total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">You have not placed any orders yet</h2>
        <p className="mt-2 text-muted">Orders you place will show up here.</p>
        <Link href="/books" className={`mt-5 inline-block ${BUTTON}`}>
          Browse books
        </Link>
      </div>
    );
  }
  if (!loading && result.items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No orders on this page</h2>
        <Link href="/orders" className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  }

  return (
    <div aria-busy={loading}>
      <p role="status" className="text-sm text-muted">
        {meta.total} {meta.total === 1 ? "order" : "orders"}
      </p>
      <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
        {result.items.map((order) => {
          const status = orderStatusOf(order);          const payment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, style: "border-line bg-paper text-muted" };
          const first = order.items[0]?.title ?? "";
          const more = order.items.length - 1;
          return (
            <li key={order.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-mono text-base font-bold">
                    <Link href={`/orders/${encodeURIComponent(order.id)}`} className="hover:text-brand hover:underline">
                      {order.orderNumber}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">Placed {formatDateTime(order.createdAt)}</p>
                  <p className="mt-1 break-words text-sm">
                    {first}
                    {more > 0 ? ` and ${more} more` : ""}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${status.style}`}>
                      {status.label}
                    </span>
                    <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${payment.style}`}>
                      {payment.label}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-lg font-bold text-brand-dark">{formatPrice(order.totalMinor)}</p>
                  <Link
                    href={`/orders/${encodeURIComponent(order.id)}`}
                    className="mt-2 inline-block rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper"
                  >
                    View order
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <PageNav page={page} totalPages={meta.totalPages} hrefFor={hrefFor} />
    </div>
  );
}
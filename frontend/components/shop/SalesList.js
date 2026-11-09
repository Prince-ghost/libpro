"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApiList } from "@/lib/use-api-list";
import { readPage } from "@/lib/url-params";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { PAYMENT_STATUS, sellerStatusOf } from "@/lib/order-labels";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";

const PAGE_SIZE = 10;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const FALLBACK = "border-line bg-paper text-muted";

export default function SalesList() {
  const page = readPage(useSearchParams().get("page"));
  const { loading, items, meta, error, reload } = useApiList(`/api/seller/orders?page=${page}&limit=${PAGE_SIZE}`);
  const hrefFor = (p) => (p > 1 ? `/sales?page=${p}` : "/sales");

  if (loading && !meta) {
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading orders…
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
        <h2 className="font-serif text-2xl font-bold">No orders for your books yet</h2>
        <p className="mt-2 text-muted">When someone orders one of your books, it will appear here.</p>
        <Link href="/my-listings" className={`mt-5 inline-block ${BUTTON}`}>
          See my listings
        </Link>
      </div>
    );
  }
  if (!loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No orders on this page</h2>
        <Link href="/sales" className={`mt-5 inline-block ${BUTTON}`}>
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
        {items.map((order) => {
          const status = sellerStatusOf(order);          const payment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, style: FALLBACK };
          return (
            <li key={order.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-mono text-base font-bold">
                    <Link href={`/sales/${encodeURIComponent(order.id)}`} className="hover:text-brand hover:underline">
                      {order.orderNumber}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">Ordered {formatDateTime(order.createdAt)}</p>
                  <ul className="mt-1 text-sm">
                    {order.items.map((item) => (
                      <li key={item.bookId} className="break-words">
                        {item.title}
                      </li>
                    ))}
                  </ul>
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
                  <p className="text-sm text-muted">Your books</p>
                  <p className="text-lg font-bold text-brand-dark">{formatPrice(order.itemsSubtotalMinor)}</p>
                  <Link
                    href={`/sales/${encodeURIComponent(order.id)}`}
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
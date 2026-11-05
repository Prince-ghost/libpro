"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { ORDER_STATUS, PAYMENT_STATUS, countryName } from "@/lib/order-labels";
import Alert from "@/components/ui/Alert";

const ID_RE = /^[a-f\d]{24}$/i;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const FALLBACK = "border-line bg-paper text-muted";

function Message({ title, children }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="mt-3 text-muted">{children}</p>
      <Link href="/sales" className={`mt-6 inline-block ${BUTTON}`}>
        Back to orders for my books
      </Link>
    </div>
  );
}

export default function SaleDetail({ id }) {
  const validId = ID_RE.test(id);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}#${attempt}`;
  const [result, setResult] = useState({ key: "", order: null, error: null });

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    api(`/api/seller/orders/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(({ data }) => setResult({ key: requestKey, order: data, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, order: null, error: err });
      });
    return () => controller.abort();
  }, [id, validId, requestKey]);

  if (!validId) return <Message title="Order not found">The link may be wrong.</Message>;

  if (result.key !== requestKey) {
    return (
      <p role="status" className="py-12 text-center text-muted">
        Loading order…
      </p>
    );
  }

  if (result.error) {
    // An order you are not selling on and an order that does not exist look exactly the same.
    if (result.error.status === 404 || result.error.status === 400) {
      return <Message title="Order not found">It may not exist, or it may not include any of your books.</Message>;
    }
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <Alert>{result.error.message}</Alert>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  }

  const order = result.order;
  const status = ORDER_STATUS[order.status] ?? { label: order.status, style: FALLBACK };
  const payment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, style: FALLBACK };
  const ship = order.shipTo;

  return (
    <article>
      <Link href="/sales" className="text-sm font-medium text-brand underline">
        ← All orders for my books
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">
            Order <span className="font-mono">{order.orderNumber}</span>
          </h2>
          <p className="text-sm text-muted">Ordered {formatDateTime(order.createdAt)}</p>
        </div>
        <p className="flex flex-wrap gap-2">
          <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${status.style}`}>
            {status.label}
          </span>
          <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${payment.style}`}>
            {payment.label}
          </span>
        </p>
      </div>

      <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
        You can only see your own books in this order and the delivery name and address, not the buyer&apos;s contact
        details. Online payment and shipping updates are not available yet.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="sale-items-heading">
            <h3 id="sale-items-heading" className="font-serif text-xl font-bold">
              Your books in this order
            </h3>
            <ul className="mt-3 space-y-3">
              {order.items.map((item) => (
                <li key={item.bookId} className="flex justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
                  <div className="min-w-0">
                    <p className="break-words font-serif text-lg font-bold leading-snug">{item.title}</p>
                    {item.author && <p className="break-words text-sm text-muted">by {item.author}</p>}
                  </div>
                  <p className="shrink-0 font-bold text-brand-dark">{formatPrice(item.unitPriceMinor)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between gap-3 font-bold">
              <span>Total for your books</span>
              <span>{formatPrice(order.itemsSubtotalMinor)}</span>
            </p>
          </section>

          <section aria-labelledby="sale-timeline-heading">
            <h3 id="sale-timeline-heading" className="font-serif text-xl font-bold">
              Order history
            </h3>
            <ol aria-label="Order timeline" className="mt-3 space-y-2">
              {order.timeline.map((event, index) => (
                <li key={`${event.status}-${index}`} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <span className="font-medium">{ORDER_STATUS[event.status]?.label ?? event.status}</span>
                  <span className="text-muted">{formatDateTime(event.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside aria-labelledby="sale-ship-heading" className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h3 id="sale-ship-heading" className="font-serif text-xl font-bold">
            Deliver to
          </h3>
          {ship ? (
            <div className="mt-3 text-sm leading-relaxed">
              <span className="block break-words font-medium">{ship.recipientName}</span>
              <span className="block break-words">{ship.line1}</span>
              {ship.line2 && <span className="block break-words">{ship.line2}</span>}
              <span className="block break-words">
                {ship.city}, {ship.state} {ship.postalCode}
              </span>
              <span className="block">{countryName(ship.country)}</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              The delivery address is hidden because this order was cancelled. There is nothing to ship.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
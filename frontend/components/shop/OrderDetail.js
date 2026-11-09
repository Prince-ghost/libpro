"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { FULFILMENT, ORDER_STATUS, PAYMENT_STATUS, orderStatusOf } from "@/lib/order-labels";
import Alert from "@/components/ui/Alert";
import AddressText from "@/components/shop/AddressText";

const ID_RE = /^[a-f\d]{24}$/i;
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const FALLBACK = "border-line bg-paper text-muted";

function Message({ title, children }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="mt-3 text-muted">{children}</p>
      <Link href="/orders" className={`mt-6 inline-block ${BUTTON}`}>
        Back to my orders
      </Link>
    </div>
  );
}

export default function OrderDetail({ id }) {
  const router = useRouter();
  const params = useSearchParams();
  const validId = ID_RE.test(id);
  const [justPlaced] = useState(() => params.get("placed") === "1");
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}#${attempt}`;
  const [result, setResult] = useState({ key: "", order: null, error: null });
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [confirmingBookId, setConfirmingBookId] = useState("");
  const [receivingId, setReceivingId] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [notice, setNotice] = useState("");

  // Take the one-time flag out of the address, so a refresh does not repeat the message.
  useEffect(() => {
    if (params.get("placed")) router.replace(`/orders/${encodeURIComponent(id)}`, { scroll: false });
  }, [params, router, id]);

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    api(`/api/orders/${encodeURIComponent(id)}`, { signal: controller.signal })
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
    // Someone else's order and an order that does not exist look exactly the same.
    if (result.error.status === 404 || result.error.status === 400) {
      return <Message title="Order not found">It may not exist, or it may belong to another account.</Message>;
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
  const cancelled = order.status === "cancelled";
  const status = orderStatusOf(order);
  const payment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, style: FALLBACK };

  async function cancel() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const { data } = await api(`/api/orders/${encodeURIComponent(order.id)}/cancel`, { method: "POST" });
      setResult((r) => ({ ...r, order: data }));
      setConfirming(false);
    } catch (err) {
      setCancelError(err?.message ?? "Could not cancel the order. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function receive(bookId) {
    if (receivingId) return;
    setReceivingId(bookId);
    setReceiveError("");
    try {
      const { data } = await api(
        `/api/orders/${encodeURIComponent(order.id)}/items/${encodeURIComponent(bookId)}/received`,
        { method: "POST" }
      );
      setResult((r) => ({ ...r, order: data }));
      setConfirmingBookId("");
      setNotice("Thanks. Marked as received.");
    } catch (err) {
      setReceiveError(err?.message ?? "Could not save this. Please try again.");
    } finally {
      setReceivingId("");
    }
  }

  return (
    <article>
      <Link href="/orders" className="text-sm font-medium text-brand underline">
        ← All orders
      </Link>

      {justPlaced && (
        <div className="mt-4">
          <Alert tone="info">
            Your order was placed. The books are being held for you. No payment has been taken.
          </Alert>
        </div>
      )}
      {notice && (
        <div className="mt-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">
            Order <span className="font-mono">{order.orderNumber}</span>
          </h2>
          <p className="text-sm text-muted">Placed {formatDateTime(order.createdAt)}</p>
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

      {!cancelled && (
        <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
          BookBack does not take online payments yet, so no money has been taken. Only confirm that you received a book
          once it is in your hands.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="items-heading">
            <h3 id="items-heading" className="font-serif text-xl font-bold">
              Books in this order
            </h3>
            <ul className="mt-3 space-y-3">
              {order.items.map((item) => {
                const state = item.fulfilment ?? "pending";
                const fulfil = FULFILMENT[state] ?? { label: state, style: FALLBACK };
                const canConfirm = !cancelled && state === "shipped";
                const askingAbout = confirmingBookId === item.bookId;
                const receiving = receivingId === item.bookId;
                return (
                  <li key={item.bookId} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words font-serif text-lg font-bold leading-snug">
                          <Link href={`/books/${encodeURIComponent(item.bookId)}`} className="hover:text-brand hover:underline">
                            {item.title}
                          </Link>
                        </p>
                        {item.author && <p className="break-words text-sm text-muted">by {item.author}</p>}
                      </div>
                      <p className="shrink-0 font-bold text-brand-dark">{formatPrice(item.unitPriceMinor)}</p>
                    </div>

                    {!cancelled && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className={`inline-block rounded-full border px-3 py-1 font-medium ${fulfil.style}`}>
                          {fulfil.label}
                        </span>
                        {state === "shipped" && item.shippedAt && (
                          <span className="text-muted">Shipped {formatDateTime(item.shippedAt)}</span>
                        )}
                        {state === "delivered" && item.deliveredAt && (
                          <span className="text-muted">Received {formatDateTime(item.deliveredAt)}</span>
                        )}
                      </p>
                    )}

                    {canConfirm &&
                      (askingAbout ? (
                        <div role="group" aria-label="Confirm receipt" className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
                          <p className="text-sm">Confirm that this book is in your hands? You cannot undo this.</p>
                          {receiveError && (
                            <p role="alert" className="mt-1 text-sm text-danger">
                              {receiveError}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => receive(item.bookId)}
                              disabled={receiving}
                              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {receiving ? "Saving…" : "Yes, I received it"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingBookId("")}
                              disabled={receiving}
                              className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60"
                            >
                              Not yet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiveError("");
                            setConfirmingBookId(item.bookId);
                          }}
                          className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-paper"
                        >
                          I have received this book
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="timeline-heading">
            <h3 id="timeline-heading" className="font-serif text-xl font-bold">
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

        <aside className="space-y-4">
          <section aria-labelledby="amounts-heading" className="rounded-2xl border border-line bg-surface p-5">
            <h3 id="amounts-heading" className="font-serif text-xl font-bold">
              Amounts
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Items</dt>
                <dd>{formatPrice(order.subtotalMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Shipping</dt>
                <dd>{formatPrice(order.shippingMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPrice(order.totalMinor)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="ship-heading" className="rounded-2xl border border-line bg-surface p-5">
            <h3 id="ship-heading" className="font-serif text-xl font-bold">
              Delivery address
            </h3>
            <div className="mt-3">
              <AddressText address={order.shippingAddress} />
            </div>
          </section>

          {order.cancellable && (
            <section aria-label="Cancel this order" className="rounded-2xl border border-line bg-surface p-5">
              {!confirming ? (
                <button
                  type="button"
                  onClick={() => {
                    setCancelError("");
                    setConfirming(true);
                  }}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-danger hover:bg-paper"
                >
                  Cancel order
                </button>
              ) : (
                <div role="group" aria-label="Confirm cancellation">
                  <p className="text-sm">Cancel this order? The books will be released so other students can buy them.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={cancelling}
                      className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {cancelling ? "Cancelling…" : "Yes, cancel it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={cancelling}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-60"
                    >
                      Keep order
                    </button>
                  </div>
                </div>
              )}
              {cancelError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {cancelError}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
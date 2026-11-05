"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApiList } from "@/lib/use-api-list";
import { buildHref, readChoice, readPage } from "@/lib/url-params";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/order-labels";
import Alert from "@/components/ui/Alert";
import PageNav from "@/components/ui/PageNav";
import SelectField from "@/components/ui/SelectField";

const PAGE_SIZE = 15;
const STATUSES = ["all", ...Object.keys(ORDER_STATUS)];
const PAYMENTS = ["all", ...Object.keys(PAYMENT_STATUS)];
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";
const FALLBACK = "border-line bg-paper text-muted";

export default function AdminOrders() {
  const router = useRouter();
  const params = useSearchParams();
  const status = readChoice(params.get("status"), STATUSES, "all");
  const payment = readChoice(params.get("payment"), PAYMENTS, "all");
  const page = readPage(params.get("page"));

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (status !== "all") query.set("status", status);
  if (payment !== "all") query.set("paymentStatus", payment);
  const { loading, items, meta, error, reload } = useApiList(`/api/admin/orders?${query}`);

  const link = (overrides) =>
    buildHref("/admin/orders", {
      status: status !== "all" ? status : "",
      payment: payment !== "all" ? payment : "",
      page: "",
      ...overrides,
    });

  let body;
  if (loading && !meta) {
    body = (
      <p role="status" className="py-8 text-center text-muted">
        Loading orders…
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
        <h2 className="font-serif text-2xl font-bold">No orders found</h2>
        <p className="mt-2 text-muted">Try a different filter.</p>
      </div>
    );
  } else if (!loading && items.length === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No orders on this page</h2>
        <Link href={link({})} className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}>
          {items.map((order) => {
            const orderStatus = ORDER_STATUS[order.status] ?? { label: order.status, style: FALLBACK };
            const orderPayment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, style: FALLBACK };
            return (
              <li key={order.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-mono text-base font-bold">{order.orderNumber}</h2>
                    <p className="text-sm text-muted">
                      {formatDateTime(order.createdAt)} · Buyer: {order.buyer?.name ?? "Unknown"}
                    </p>
                    <ul className="mt-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.bookId} className="break-words">
                          {item.title} · {formatPrice(item.unitPriceMinor)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${orderStatus.style}`}>
                        {orderStatus.label}
                      </span>
                      <span className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${orderPayment.style}`}>
                        {orderPayment.label}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-sm sm:text-right">
                    <p className="text-muted">
                      Items {formatPrice(order.subtotalMinor)} + shipping {formatPrice(order.shippingMinor)}
                    </p>
                    <p className="text-lg font-bold text-brand-dark">{formatPrice(order.totalMinor)}</p>
                  </div>
                </div>
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
      <p className="text-sm text-muted">
        A read-only overview. Delivery addresses, phone numbers and emails are not shown here.
      </p>
      <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <SelectField
          id="status"
          label="Order status"
          value={status}
          onChange={(event) => router.push(link({ status: event.target.value !== "all" ? event.target.value : "" }))}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : ORDER_STATUS[value].label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="payment"
          label="Payment"
          value={payment}
          onChange={(event) => router.push(link({ payment: event.target.value !== "all" ? event.target.value : "" }))}
        >
          {PAYMENTS.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : PAYMENT_STATUS[value].label}
            </option>
          ))}
        </SelectField>
      </div>
      {meta && !error && (
        <p role="status" className="mt-4 text-sm text-muted">
          {meta.total} {meta.total === 1 ? "order" : "orders"}
        </p>
      )}
      {body}
    </div>
  );
}
import { Suspense } from "react";
import Link from "next/link";
import RequireAuth from "@/components/auth/RequireAuth";
import OrdersList from "@/components/shop/OrdersList";

export const metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">My orders</h1>
          <p className="mt-2 text-muted">Books you have ordered, newest first.</p>
        </div>
        <Link
          href="/addresses"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Manage addresses
        </Link>
      </div>
      <div className="mt-6">
        <RequireAuth>
          <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
            <OrdersList />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}
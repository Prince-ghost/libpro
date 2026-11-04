import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import OrderDetail from "@/components/shop/OrderDetail";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-serif text-3xl font-bold">Your order</h1>
      <div className="mt-4">
        <RequireAuth>
          <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
            <OrderDetail id={id} />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}
import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import SalesList from "@/components/shop/SalesList";

export const metadata = { title: "Orders for my books" };

export default function SalesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="font-serif text-3xl font-bold">Orders for my books</h1>
      <p className="mt-2 text-muted">Orders that include books you have listed, newest first.</p>
      <div className="mt-6">
        <RequireAuth>
          <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
            <SalesList />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}
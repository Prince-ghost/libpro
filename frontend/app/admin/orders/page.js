import { Suspense } from "react";
import AdminOrders from "@/components/admin/AdminOrders";

export const metadata = { title: "Admin: orders" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
      <AdminOrders />
    </Suspense>
  );
}
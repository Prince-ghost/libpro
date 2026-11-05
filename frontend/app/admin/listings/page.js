import { Suspense } from "react";
import AdminListings from "@/components/admin/AdminListings";

export const metadata = { title: "Admin: listings" };

export default function AdminListingsPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
      <AdminListings />
    </Suspense>
  );
}
import { Suspense } from "react";
import AdminUsers from "@/components/admin/AdminUsers";

export const metadata = { title: "Admin: users" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
      <AdminUsers />
    </Suspense>
  );
}
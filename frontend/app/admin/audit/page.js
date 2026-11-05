import { Suspense } from "react";
import AdminAudit from "@/components/admin/AdminAudit";

export const metadata = { title: "Admin: audit log" };

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
      <AdminAudit />
    </Suspense>
  );
}
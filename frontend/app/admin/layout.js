import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import AdminNav from "@/components/admin/AdminNav";

// Every page under /admin shows up only for logged-in admins. The server checks again on every request.
export default function AdminLayout({ children }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-serif text-3xl font-bold">Admin</h1>
      <RequireAuth>
        <RequireAdmin>
          <AdminNav />
          <div className="mt-6">{children}</div>
        </RequireAdmin>
      </RequireAuth>
    </div>
  );
}
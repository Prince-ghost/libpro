"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import Alert from "@/components/ui/Alert";

// Shows its content only to logged-in people. Everyone else is sent to the login page and
// brought back here afterwards. The real protection is on the server; this is for convenience.
export default function RequireAuth({ children }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status === "authenticated") return children;

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md space-y-3 py-12 text-center">
        <Alert>Cannot reach the server. Check your connection and try again.</Alert>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Reload page
        </button>
      </div>
    );
  }

  return (
    <p role="status" className="py-12 text-center text-muted">
      {status === "anonymous" ? "Taking you to the login page…" : "Checking your login…"}
    </p>
  );
}
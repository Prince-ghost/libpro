import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <h1 className="font-serif text-3xl font-bold">Reset your password</h1>
      <p className="mt-2 text-muted">Choose a new password for your account.</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

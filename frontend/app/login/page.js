import { Suspense } from "react";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <h1 className="font-serif text-3xl font-bold">Log in</h1>
      <p className="mt-2 text-muted">Welcome back to BookBack.</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <GoogleSignIn />
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
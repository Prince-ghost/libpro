import { Suspense } from "react";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = { title: "Sign up" };

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <h1 className="font-serif text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">Buy, sell and give your old books a second life.</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <GoogleSignIn />
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
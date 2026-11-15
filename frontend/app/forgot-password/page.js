import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <h1 className="font-serif text-3xl font-bold">Forgot your password?</h1>
      <p className="mt-2 text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

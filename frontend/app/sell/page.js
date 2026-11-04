import RequireAuth from "@/components/auth/RequireAuth";
import SellForm from "@/components/books/SellForm";

export const metadata = { title: "Sell a book" };

export default function SellPage() {
  return (
    <div className="mx-auto w-full max-w-2xl py-4 sm:py-8">
      <h1 className="font-serif text-3xl font-bold">Sell a book</h1>
      <p className="mt-2 text-muted">
        Listings are checked before they appear on BookBack. Photo uploads and payments are not available yet.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <RequireAuth>
          <SellForm />
        </RequireAuth>
      </div>
    </div>
  );
}
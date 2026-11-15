import RequireAuth from "@/components/auth/RequireAuth";
import ExchangeList from "@/components/shop/ExchangeList";

export const metadata = { title: "Exchange requests" };

export default function ExchangesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="font-serif text-3xl font-bold">Exchange requests</h1>
      <p className="mt-2 text-muted">Request a book exchange and manage requests for your listings.</p>
      <div className="mt-6">
        <RequireAuth>
          <ExchangeList />
        </RequireAuth>
      </div>
    </div>
  );
}

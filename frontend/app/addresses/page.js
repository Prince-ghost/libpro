import RequireAuth from "@/components/auth/RequireAuth";
import AddressesView from "@/components/shop/AddressesView";

export const metadata = { title: "My addresses" };

export default function AddressesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-3xl font-bold">My addresses</h1>
      <p className="mt-2 text-muted">Where your books are delivered. You can save up to 10 addresses.</p>
      <div className="mt-6">
        <RequireAuth>
          <AddressesView />
        </RequireAuth>
      </div>
    </div>
  );
}
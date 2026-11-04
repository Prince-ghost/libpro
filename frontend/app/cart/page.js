import RequireAuth from "@/components/auth/RequireAuth";
import CartView from "@/components/shop/CartView";

export const metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Your cart</h1>
      <p className="mt-2 text-muted">Used books are one of a kind, so each one can only be in your cart once.</p>
      <div className="mt-6">
        <RequireAuth>
          <CartView />
        </RequireAuth>
      </div>
    </div>
  );
}
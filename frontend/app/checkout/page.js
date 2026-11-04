import RequireAuth from "@/components/auth/RequireAuth";
import CheckoutView from "@/components/shop/CheckoutView";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Checkout</h1>
      <p className="mt-2 text-muted">Choose where to deliver your books, then place your order.</p>
      <div className="mt-6">
        <RequireAuth>
          <CheckoutView />
        </RequireAuth>
      </div>
    </div>
  );
}
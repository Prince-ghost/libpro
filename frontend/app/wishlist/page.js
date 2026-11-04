import RequireAuth from "@/components/auth/RequireAuth";
import WishlistView from "@/components/shop/WishlistView";

export const metadata = { title: "Your wishlist" };

export default function WishlistPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Your wishlist</h1>
      <p className="mt-2 text-muted">Books you saved for later.</p>
      <div className="mt-6">
        <RequireAuth>
          <WishlistView />
        </RequireAuth>
      </div>
    </div>
  );
}
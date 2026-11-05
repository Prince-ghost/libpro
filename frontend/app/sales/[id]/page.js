import RequireAuth from "@/components/auth/RequireAuth";
import SaleDetail from "@/components/shop/SaleDetail";

export const metadata = { title: "Order for my books" };

export default async function SalePage({ params }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-serif text-3xl font-bold">Order for my books</h1>
      <div className="mt-4">
        <RequireAuth>
          <SaleDetail id={id} />
        </RequireAuth>
      </div>
    </div>
  );
}
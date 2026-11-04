import RequireAuth from "@/components/auth/RequireAuth";
import EditListing from "@/components/books/EditListing";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-2xl py-4 sm:py-8">
      <h1 className="font-serif text-3xl font-bold">Edit listing</h1>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <RequireAuth>
          <EditListing id={id} />
        </RequireAuth>
      </div>
    </div>
  );
}
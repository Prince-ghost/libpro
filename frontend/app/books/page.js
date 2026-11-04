import { Suspense } from "react";
import BrowseBooks from "@/components/books/BrowseBooks";

export const metadata = {
  title: "Browse books",
  description: "Search used school and college books listed by other students.",
};

export default function BooksPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Browse books</h1>
      <p className="mt-2 text-muted">Used school and college books listed by other students.</p>
      <div className="mt-6">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <BrowseBooks />
        </Suspense>
      </div>
    </div>
  );
}
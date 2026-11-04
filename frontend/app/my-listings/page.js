import { Suspense } from "react";
import Link from "next/link";
import RequireAuth from "@/components/auth/RequireAuth";
import MyListings from "@/components/books/MyListings";

export const metadata = { title: "My listings" };

export default function MyListingsPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">My listings</h1>
          <p className="mt-2 text-muted">Books you have put up for sale, and whether they are approved.</p>
        </div>
        <Link
          href="/sell"
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Sell a book
        </Link>
      </div>
      <div className="mt-6">
        <RequireAuth>
          <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
            <MyListings />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}
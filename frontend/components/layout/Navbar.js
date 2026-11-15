import Link from "next/link";
import AuthNav from "@/components/layout/AuthNav";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-bold text-brand">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            BookBack
          </Link>
          <Link href="/books" className="text-sm font-medium hover:text-brand">
            Browse
          </Link>
          <Link href="/sell" className="text-sm font-medium hover:text-brand">
            Sell
          </Link>
        </div>
        <form action="/books" method="get" className="order-3 flex w-full max-w-md gap-2 sm:order-none sm:flex-1 sm:px-4">
          <label htmlFor="nav-search" className="sr-only">
            Search for books
          </label>
          <input
            id="nav-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder="Search books, authors or subjects"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Search
          </button>
        </form>
        <AuthNav />
      </div>
    </header>
  );
}
import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-brand">Error 404</p>
      <h1 className="mt-2 font-serif text-3xl font-bold">We could not find that page</h1>
      <p className="mt-3 text-muted">The link may be wrong, or the page may have moved.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
      >
        Back to home
      </Link>
    </div>
  );
}
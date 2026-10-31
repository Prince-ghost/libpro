import ApiStatus from "@/components/ui/ApiStatus";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">Used books, second lives</p>
      <h1 className="mt-3 font-serif text-4xl font-bold leading-tight sm:text-5xl">
        Buy and sell school and college books
      </h1>
      <p className="mt-4 text-lg text-muted">
        BookBack connects students who have finished with their books to students who need them.
      </p>
      <div className="mt-10">
        <ApiStatus />
      </div>
      <p className="mt-6 text-sm text-muted">
        This is an early build. Browsing, selling and checkout are being added step by step.
      </p>
    </div>
  );
}
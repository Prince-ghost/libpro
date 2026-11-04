import Link from "next/link";
import BookCover from "@/components/books/BookCover";
import { AUDIENCE_LABELS, CONDITION_LABELS, formatPrice } from "@/lib/format";

export default function BookCard({ book }) {
  return (
    <li>
      <Link
        href={`/books/${encodeURIComponent(book.id)}`}
        className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-3 transition hover:border-brand hover:shadow-sm"
      >
        <BookCover book={book} />
        <h2 className="mt-3 line-clamp-2 break-words font-serif text-base font-bold leading-snug group-hover:text-brand sm:text-lg">
          {book.title}
        </h2>
        <p className="mt-1 line-clamp-1 break-words text-sm text-muted">{book.author}</p>
        <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{AUDIENCE_LABELS[book.audience] ?? book.audience}</span>
          <span aria-hidden="true">·</span>
          <span>{CONDITION_LABELS[book.condition] ?? book.condition}</span>
        </p>
        <p className="mt-auto pt-3 text-lg font-bold text-brand-dark">{formatPrice(book.priceMinor)}</p>
      </Link>
    </li>
  );
}
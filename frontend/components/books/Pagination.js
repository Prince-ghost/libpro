import Link from "next/link";
import { browseHref } from "@/lib/browse-params";

function pagesAround(page, totalPages) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export default function Pagination({ values, totalPages }) {
  if (!totalPages || totalPages <= 1) return null;
  const page = values.page;
  const hrefFor = (p) => browseHref({ ...values, page: p });
  const base = "rounded-lg border px-3 py-2 text-sm font-medium";

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${base} border-line hover:bg-surface`}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-line text-muted opacity-50`}>
          Previous
        </span>
      )}

      {pagesAround(page, totalPages).map((p) =>
        p === page ? (
          <span key={p} aria-current="page" className={`${base} border-brand bg-brand text-white`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} aria-label={`Page ${p}`} className={`${base} border-line hover:bg-surface`}>
            {p}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={`${base} border-line hover:bg-surface`}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-line text-muted opacity-50`}>
          Next
        </span>
      )}
    </nav>
  );
}
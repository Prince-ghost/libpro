"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { SORT_LABELS } from "@/lib/format";
import { apiQueryFor, browseHref, hasActiveFilters, readBrowseParams } from "@/lib/browse-params";
import Alert from "@/components/ui/Alert";
import BookCard from "@/components/books/BookCard";
import Pagination from "@/components/books/Pagination";
import SearchFilters from "@/components/books/SearchFilters";

const GRID = "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";
const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";

function SkeletonGrid() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading books…
      </p>
      <ul aria-hidden="true" className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="animate-pulse rounded-2xl border border-line bg-surface p-3">
            <div className="aspect-[3/4] rounded-lg bg-line" />
            <div className="mt-3 h-4 w-3/4 rounded bg-line" />
            <div className="mt-2 h-3 w-1/2 rounded bg-line" />
            <div className="mt-4 h-5 w-1/3 rounded bg-line" />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function BrowseBooks() {
  const router = useRouter();
  const queryString = useSearchParams().toString();
  const values = useMemo(() => readBrowseParams(new URLSearchParams(queryString)), [queryString]);
  const apiQuery = useMemo(() => apiQueryFor(values), [values]);

  const [attempt, setAttempt] = useState(0);
  const requestKey = `${apiQuery}#${attempt}`;
  // "key" says which request this result belongs to, so we can tell when it is out of date.
  const [result, setResult] = useState({ key: "", items: [], meta: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/books?${apiQuery}`, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key: requestKey, items: data, meta, error: null }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({ key: requestKey, items: [], meta: null, error: err });
      });
    return () => controller.abort(); // a newer search cancels the older one
  }, [apiQuery, requestKey]);

  const loading = result.key !== requestKey;
  const meta = result.meta;
  const filtersActive = hasActiveFilters(values);
  const go = (next) => router.push(browseHref(next));

  let summary = "Loading books…";
  if (meta) {
    const from = (meta.page - 1) * meta.limit + 1;
    const to = from + result.items.length - 1;
    if (loading) summary = "Updating results…";
    else if (meta.total === 0) summary = "No books found.";
    else if (result.items.length === 0) summary = `There are ${meta.total} books, but none on this page.`;
    else summary = `Showing ${from} to ${to} of ${meta.total} ${meta.total === 1 ? "book" : "books"}`;
  }

  let body;
  if (result.key === "" || (loading && !meta)) {
    body = <SkeletonGrid />;
  } else if (!loading && result.error) {
    body = (
      <div className="mt-4 space-y-3">
        <Alert>{result.error.message}</Alert>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON}>
          Try again
        </button>
      </div>
    );
  } else if (!loading && meta.total === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">
          {filtersActive ? "No books match your search" : "No books are listed yet"}
        </h2>
        <p className="mt-2 text-muted">
          {filtersActive ? "Try different words, or remove some filters." : "Check back soon."}
        </p>
        {filtersActive && (
          <button type="button" onClick={() => router.push("/books")} className={`mt-5 ${BUTTON}`}>
            Clear all filters
          </button>
        )}
      </div>
    );
  } else if (!loading && result.items.length === 0) {
    body = (
      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">No books on this page</h2>
        <p className="mt-2 text-muted">This page number is past the last page of results.</p>
        <Link href={browseHref({ ...values, page: 1 })} className={`mt-5 inline-block ${BUTTON}`}>
          Go to the first page
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={`${GRID} ${loading ? "opacity-60" : ""}`}>
          {result.items.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </ul>
        <Pagination values={values} totalPages={meta.totalPages} />
      </>
    );
  }

  return (
    <div>
      <SearchFilters
        values={values}
        canClear={filtersActive}
        onApply={go}
        onClear={() => router.push("/books")}
      />

      <div className="mt-6" aria-busy={loading}>
        {meta && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted">
              {summary}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-muted">
                Sort by
              </label>
              <select
                id="sort"
                value={values.sort}
                onChange={(event) => go({ ...values, sort: event.target.value, page: 1 })}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {body}
      </div>
    </div>
  );
}
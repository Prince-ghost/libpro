"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ApiStatus from "@/components/ui/ApiStatus";
import BookCard from "@/components/books/BookCard";
import { api } from "@/lib/api";

const categories = [
  { icon: "▣", name: "All books", detail: "Explore all", href: "/books" },
  { icon: "⌘", name: "Computer science", detail: "Tech & coding", href: "/books?category=Computer%20Science" },
  { icon: "⚙", name: "Mathematics", detail: "Core subjects", href: "/books?category=Mathematics" },
  { icon: "▥", name: "Economics", detail: "Business & MBA", href: "/books?category=Economics" },
  { icon: "⚗", name: "Biology", detail: "Health & science", href: "/books?category=Biology" },
  { icon: "✦", name: "English", detail: "Arts & humanities", href: "/books?category=English" },
  { icon: "⇄", name: "Exchange", detail: "Swap books", href: "/exchanges" },
  { icon: "✚", name: "Sell a book", detail: "Give back", href: "/sell" },
];

function HeroBooks() {
  const books = [
    { title: "Clean Code", color: "bg-slate-800" },
    { title: "Design Patterns", color: "bg-brand" },
    { title: "JavaScript", color: "bg-amber-500" },
    { title: "System Design", color: "bg-slate-700" },
    { title: "Data Structures", color: "bg-stone-700" },
  ];

  return (
    <div className="relative hidden min-h-72 overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand/15 via-brand/5 to-amber-100/70 lg:block">
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/25 blur-2xl" />
      <div className="absolute right-8 top-8 text-right font-serif text-3xl font-bold leading-tight text-white drop-shadow-lg">
        Better books
        <br />
        brighter future
      </div>
      <div className="absolute bottom-10 left-1/2 w-72 -translate-x-1/2 rotate-[-4deg] space-y-1">
        {books.map((book, index) => (
          <div
            key={book.title}
            className={`flex h-9 items-center rounded-md px-4 text-sm font-bold text-white shadow-lg ${book.color}`}
            style={{ width: `${80 + index * 4}%`, marginLeft: `${index * 2}%` }}
          >
            {book.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/books?limit=5&sort=newest", { signal: controller.signal })
      .then(({ data }) => setBooks(data ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="animate-pulse rounded-2xl border border-line bg-surface p-3">
            <div className="aspect-[3/4] rounded-lg bg-line" />
            <div className="mt-3 h-4 rounded bg-line" />
            <div className="mt-2 h-4 w-2/3 rounded bg-line" />
          </li>
        ))}
      </ul>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="font-serif text-xl font-bold">Books are arriving soon</p>
        <p className="mt-2 text-sm text-muted">Be the first to give a book its second life.</p>
        <Link href="/sell" className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark">
          Sell a book
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-10 pb-8">
      <section className="grid overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-white via-paper to-brand/10 shadow-sm lg:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
            <span aria-hidden="true">♻</span>
            Reuse · resell · reconnect
          </p>
          <h1 className="mt-5 max-w-xl font-serif text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Give books a <span className="text-brand">second life</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted sm:text-lg">
            Buy, sell and exchange school and college books. Save money, help the environment and keep knowledge moving.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/books" className="rounded-lg bg-brand px-5 py-3 font-medium text-white shadow-sm hover:bg-brand-dark">
              Explore books <span aria-hidden="true">→</span>
            </Link>
            <Link href="/sell" className="rounded-lg border border-brand px-5 py-3 font-medium text-brand hover:bg-brand/5">
              Sell your book
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-5 text-sm">
            <p><strong className="block text-lg text-brand">10K+</strong><span className="text-muted">Readers reached</span></p>
            <p className="border-l border-line pl-5"><strong className="block text-lg text-brand">50K+</strong><span className="text-muted">Books listed</span></p>
            <p className="border-l border-line pl-5"><strong className="block text-lg text-brand">100%</strong><span className="text-muted">Knowledge reused</span></p>
          </div>
        </div>
        <HeroBooks />
      </section>

      <section aria-label="Book categories" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="group rounded-2xl border border-line bg-surface px-3 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-xl text-brand group-hover:bg-brand group-hover:text-white">
              {category.icon}
            </span>
            <strong className="mt-2 block text-sm capitalize">{category.name}</strong>
            <span className="text-xs text-muted">{category.detail}</span>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand">Fresh from our community</p>
            <h2 className="mt-1 font-serif text-3xl font-bold">Featured books</h2>
          </div>
          <Link href="/books" className="text-sm font-bold text-brand underline">
            View all books →
          </Link>
        </div>
        <FeaturedBooks />
      </section>

      <div className="text-center">
        <ApiStatus />
      </div>
    </div>
  );
}

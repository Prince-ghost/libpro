"use client";

import { useState } from "react";
import { imageUrl } from "@/lib/images";

// Shows the seller's cover photo. If a book has no photo, or the photo cannot be loaded, a cover is
// generated from the title and author. The generated one is decoration only (hidden from screen readers).
const PALETTE = [
  "bg-emerald-100 text-emerald-900",
  "bg-amber-100 text-amber-900",
  "bg-sky-100 text-sky-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-teal-100 text-teal-900",
];

function colourFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function BookCover({ book, size = "card" }) {
  const large = size === "large";
  const coverId = book.images?.[0];
  const [failedId, setFailedId] = useState("");

  if (coverId && failedId !== coverId) {
    return (
      <div className={`aspect-[3/4] w-full overflow-hidden rounded-lg border border-line bg-paper ${large ? "max-w-xs" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(coverId, "thumb")}
          alt=""
          loading="lazy"
          onError={() => setFailedId(coverId)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-lg ${colourFor(book.id)} ${
        large ? "max-w-xs p-5" : "p-3"
      }`}
    >
      <span className={`font-serif font-bold leading-snug ${large ? "line-clamp-6 text-2xl" : "line-clamp-4 text-base"}`}>
        {book.title}
      </span>
      <span className={`line-clamp-2 opacity-80 ${large ? "text-base" : "text-xs"}`}>{book.author}</span>
    </div>
  );
}
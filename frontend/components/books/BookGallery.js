"use client";

import { useState } from "react";
import BookCover from "@/components/books/BookCover";
import { imageUrl } from "@/lib/images";

export default function BookGallery({ book }) {
  const images = book.images ?? [];
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState({});

  if (images.length === 0) return <BookCover book={book} size="large" />;

  const index = Math.min(selected, images.length - 1);
  const currentId = images[index];

  return (
    <div className="max-w-xs">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-line bg-paper">
        {broken[currentId] ? (
          <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
            This photo could not be loaded.
          </p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(currentId)}
              alt={`Photo ${index + 1} of ${images.length}: ${book.title}`}
              onError={() => setBroken((b) => ({ ...b, [currentId]: true }))}
              className="h-full w-full object-contain"
            />
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul aria-label="Choose a photo" className="mt-3 flex flex-wrap gap-2">
          {images.map((id, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={i === index}
                className={`h-16 w-12 overflow-hidden rounded-md border-2 ${i === index ? "border-brand" : "border-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(id, "thumb")} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
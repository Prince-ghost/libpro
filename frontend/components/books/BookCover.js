// Photos are not available yet, so each book gets a generated cover from its title and author.
// It is decoration only (hidden from screen readers); the real text is next to it.
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
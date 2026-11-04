"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShop } from "@/components/shop/ShopProvider";

function Heart({ filled }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

// compact = just the heart (for cards). Otherwise a button with words (for the book page).
export default function WishlistButton({ book, compact = false, className = "" }) {
  const { status } = useAuth();
  const { wishlistHas, saveToWishlist, removeFromWishlist } = useShop();
  const router = useRouter();
  const saved = wishlistHas(book.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    if (busy || status === "loading") return;
    if (status === "anonymous") {
      // Log in, then come back to exactly this page.
      const here = window.location.pathname + window.location.search;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    if (status === "error") {
      setError("Cannot reach the server.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (saved) await removeFromWishlist(book.id);
      else await saveToWishlist(book.id);
    } catch (err) {
      setError(err?.message ?? "Could not update your wishlist.");
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? `Remove ${book.title} from your wishlist` : `Save ${book.title} to your wishlist`;
  const tone = saved ? "text-danger" : "text-muted";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={saved}
        aria-label={label}
        className={
          compact
            ? `flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/95 shadow-sm hover:bg-white disabled:opacity-60 ${tone}`
            : `inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 font-medium hover:bg-paper disabled:opacity-60 ${tone}`
        }
      >
        <Heart filled={saved} />
        {!compact && <span className="text-ink">{saved ? "Saved to wishlist" : "Save to wishlist"}</span>}
      </button>
      {error && (
        <p
          role="alert"
          className={compact ? "mt-1 max-w-[10rem] rounded bg-danger px-2 py-1 text-xs text-white" : "mt-2 text-sm text-danger"}
        >
          {error}
        </p>
      )}
    </div>
  );
}
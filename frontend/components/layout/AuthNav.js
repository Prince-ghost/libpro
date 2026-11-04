"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShop } from "@/components/shop/ShopProvider";

const LINK = "rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface";

export default function AuthNav() {
  const { status, user, logout } = useAuth();
  const { cart, wishlist } = useShop();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await logout();
      router.push("/");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <div aria-hidden="true" className="h-9 w-28 animate-pulse rounded-lg bg-line" />;
  }

  if (status === "authenticated") {
    const cartCount = cart.loaded ? cart.count : 0;
    const wishCount = wishlist.loaded ? wishlist.count : 0;
    return (
      <nav aria-label="Account" className="flex flex-wrap items-center gap-1 sm:gap-2">
        <Link href="/my-listings" className={LINK}>
          My listings
        </Link>
        <Link
          href="/wishlist"
          className={LINK}
          aria-label={wishCount > 0 ? `Wishlist, ${wishCount} saved` : "Wishlist"}
        >
          Wishlist{wishCount > 0 ? ` (${wishCount})` : ""}
        </Link>
        <Link
          href="/cart"
          className={LINK}
          aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"}
        >
          Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
        <span className="hidden max-w-[10rem] truncate text-sm text-muted lg:inline" title={user.name}>
          {user.name}
        </span>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
        >
          {busy ? "Logging out…" : "Log out"}
        </button>
        {failed && (
          <span role="alert" className="text-xs text-danger">
            Could not log out. Try again.
          </span>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Link href="/login" className={LINK}>
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Sign up
      </Link>
    </nav>
  );
}
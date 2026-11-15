"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShop } from "@/components/shop/ShopProvider";

const LINK = "relative rounded-lg p-2 text-brand hover:bg-surface";

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6" />
      <circle cx="10" cy="19" r="1.2" />
      <circle cx="18" cy="19" r="1.2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}

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
        <Link
          href="/wishlist"
          className={LINK}
          aria-label={wishCount > 0 ? `Wishlist, ${wishCount} saved` : "Wishlist"}
          title="Wishlist"
        >
          <HeartIcon />
          <span className="sr-only">Wishlist</span>
          {wishCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 text-white">
              {wishCount}
            </span>
          )}
        </Link>
        <Link href="/exchanges" className={LINK} title="Exchange requests" aria-label="Exchange requests">
          <span aria-hidden="true">⇄</span>
          <span className="sr-only">Exchange requests</span>
        </Link>
        <Link
          href="/cart"
          className={LINK}
          aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"}
          title="Cart"
        >
          <CartIcon />
          <span className="sr-only">Cart</span>
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 text-white">
              {cartCount}
            </span>
          )}
        </Link>
        <Link href="/account" className={`${LINK} flex items-center gap-1`} title={user.name} aria-label={`Account: ${user.name}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {user.name?.trim().charAt(0).toUpperCase() || <UserIcon />}
          </span>
          <span className="sr-only">Account</span>
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className={LINK} title="Admin" aria-label="Admin">
            <span aria-hidden="true">▦</span>
            <span className="sr-only">Admin</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="rounded-lg border border-line p-2 text-brand hover:bg-surface disabled:opacity-60"
          title="Log out"
          aria-label="Log out"
        >
          {busy ? <span className="text-xs">…</span> : <LogoutIcon />}
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
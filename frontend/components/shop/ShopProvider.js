"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

const EMPTY_CART = { items: [], count: 0, subtotalMinor: 0 };
const EMPTY_CART_STATE = { loaded: false, error: null, cart: EMPTY_CART, removed: [] };
const EMPTY_WISH_STATE = { loaded: false, error: null, items: [] };

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const { status, user } = useAuth();
  const userId = status === "authenticated" ? user.id : null;

  // Each piece of saved state remembers whose it is, so one person's cart can never
  // show up for the next person who logs in on the same screen.
  const [cartState, setCartState] = useState({ ownerId: null, ...EMPTY_CART_STATE });
  const [wishState, setWishState] = useState({ ownerId: null, ...EMPTY_WISH_STATE });

  const applyCart = useCallback((ownerId, data, meta) => {
    setCartState({ ownerId, loaded: true, error: null, cart: data, removed: meta?.removed ?? [] });
  }, []);
  const applyWishlist = useCallback((ownerId, data) => {
    setWishState({ ownerId, loaded: true, error: null, items: data.items });
  }, []);

  const failCart = useCallback((ownerId, error) => {
    setCartState((prev) => ({ ...(prev.ownerId === ownerId ? prev : EMPTY_CART_STATE), ownerId, error }));
  }, []);
  const failWishlist = useCallback((ownerId, error) => {
    setWishState((prev) => ({ ...(prev.ownerId === ownerId ? prev : EMPTY_WISH_STATE), ownerId, error }));
  }, []);

  // Load both lists once when someone logs in.
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const { signal } = controller;
    api("/api/cart", { signal })
      .then(({ data, meta }) => applyCart(userId, data, meta))
      .catch((err) => {
        if (err?.name !== "AbortError") failCart(userId, err);
      });
    api("/api/wishlist", { signal })
      .then(({ data }) => applyWishlist(userId, data))
      .catch((err) => {
        if (err?.name !== "AbortError") failWishlist(userId, err);
      });
    return () => controller.abort();
  }, [userId, applyCart, applyWishlist, failCart, failWishlist]);

  const refreshCart = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, meta } = await api("/api/cart");
      applyCart(userId, data, meta);
    } catch (err) {
      failCart(userId, err);
    }
  }, [userId, applyCart, failCart]);

  const refreshWishlist = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await api("/api/wishlist");
      applyWishlist(userId, data);
    } catch (err) {
      failWishlist(userId, err);
    }
  }, [userId, applyWishlist, failWishlist]);

  // The actions below only send the book id. The server answers with the whole updated list,
  // and that answer is what the screen shows.
  const addToCart = useCallback(
    async (bookId) => {
      if (!userId) throw new Error("Please log in first.");
      const { data, meta } = await api("/api/cart/items", { method: "POST", body: { bookId } });
      applyCart(userId, data, meta);
    },
    [userId, applyCart]
  );

  const removeFromCart = useCallback(
    async (bookId) => {
      if (!userId) throw new Error("Please log in first.");
      const { data, meta } = await api(`/api/cart/items/${encodeURIComponent(bookId)}`, { method: "DELETE" });
      applyCart(userId, data, meta);
    },
    [userId, applyCart]
  );

  const saveToWishlist = useCallback(
    async (bookId) => {
      if (!userId) throw new Error("Please log in first.");
      const { data } = await api(`/api/wishlist/${encodeURIComponent(bookId)}`, { method: "POST" });
      applyWishlist(userId, data);
    },
    [userId, applyWishlist]
  );

  const removeFromWishlist = useCallback(
    async (bookId) => {
      if (!userId) throw new Error("Please log in first.");
      const { data } = await api(`/api/wishlist/${encodeURIComponent(bookId)}`, { method: "DELETE" });
      applyWishlist(userId, data);
    },
    [userId, applyWishlist]
  );

  const value = useMemo(() => {
    const mineCart = userId && cartState.ownerId === userId ? cartState : EMPTY_CART_STATE;
    const mineWish = userId && wishState.ownerId === userId ? wishState : EMPTY_WISH_STATE;
    const cartIds = new Set(mineCart.cart.items.map((item) => item.book.id));
    const wishIds = new Set(mineWish.items.map((book) => book.id));
    return {
      cart: {
        loaded: mineCart.loaded,
        error: mineCart.error,
        items: mineCart.cart.items,
        count: mineCart.cart.count,
        subtotalMinor: mineCart.cart.subtotalMinor,
        removed: mineCart.removed,
      },
      wishlist: {
        loaded: mineWish.loaded,
        error: mineWish.error,
        items: mineWish.items,
        count: mineWish.items.length,
      },
      cartHas: (bookId) => cartIds.has(bookId),
      wishlistHas: (bookId) => wishIds.has(bookId),
      addToCart,
      removeFromCart,
      saveToWishlist,
      removeFromWishlist,
      refreshCart,
      refreshWishlist,
    };
  }, [
    userId,
    cartState,
    wishState,
    addToCart,
    removeFromCart,
    saveToWishlist,
    removeFromWishlist,
    refreshCart,
    refreshWishlist,
  ]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
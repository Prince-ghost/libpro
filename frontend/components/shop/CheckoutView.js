"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useShop } from "@/components/shop/ShopProvider";
import { useAddresses } from "@/components/shop/useAddresses";
import AddressForm from "@/components/shop/AddressForm";
import AddressText from "@/components/shop/AddressText";
import Alert from "@/components/ui/Alert";

const BUTTON = "rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark";

export default function CheckoutView() {
  const router = useRouter();
  const { cart, refreshCart } = useShop();
  const addr = useAddresses();
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placedId, setPlacedId] = useState("");
  const [error, setError] = useState(null);
  // One key per checkout visit. Pressing Place order twice, or retrying after a network drop,
  // can then never create two orders: the server answers a repeat with the original order.
  const keyRef = useRef(null);

  // Opening checkout asks the server for the latest cart, so sold books drop out first.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  if (placedId) {
    return (
      <p role="status" className="py-12 text-center text-muted">
        Order placed. Opening your order…
      </p>
    );
  }

  if (!cart.loaded) {
    if (cart.error) {
      return (
        <div className="space-y-3">
          <Alert>{cart.error.message}</Alert>
          <button type="button" onClick={refreshCart} className={BUTTON}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your cart…
      </p>
    );
  }

  if (!addr.loaded) {
    if (addr.error) {
      return (
        <div className="space-y-3">
          <Alert>{addr.error.message}</Alert>
          <button type="button" onClick={addr.reload} className={BUTTON}>
            Try again
          </button>
        </div>
      );
    }
    return (
      <p role="status" className="py-8 text-center text-muted">
        Loading your addresses…
      </p>
    );
  }

  if (cart.count === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <h2 className="font-serif text-2xl font-bold">Your cart is empty</h2>
        <p className="mt-2 text-muted">Add a book to your cart before checking out.</p>
        <Link href="/books" className={`mt-5 inline-block ${BUTTON}`}>
          Browse books
        </Link>
      </div>
    );
  }

  const addresses = addr.items;
  const fallback = addresses.find((a) => a.isDefault) ?? addresses[0];
  const chosen = addresses.some((a) => a.id === selectedId) ? selectedId : (fallback?.id ?? "");
  const showForm = adding || addresses.length === 0;

  async function createAddress(payload) {
    const { data } = await api("/api/addresses", { method: "POST", body: payload });
    setSelectedId(data.id);
    setAdding(false);
    addr.reload();
  }

  async function placeOrder() {
    if (placing || !chosen) return;
    setError(null);
    setPlacing(true);
    keyRef.current ??= crypto.randomUUID();
    try {
      // Only the address id is sent. The server re-reads the cart and works out every price itself.
      const { data } = await api("/api/orders", {
        method: "POST",
        body: { addressId: chosen },
        headers: { "Idempotency-Key": keyRef.current },
      });
      setPlacedId(data.id);
      await refreshCart(); // the server emptied the cart
      router.push(`/orders/${encodeURIComponent(data.id)}?placed=1`);
    } catch (err) {
      setPlacing(false);
      if (err?.status === 401) {
        setError({ text: "Your session has expired. Please log in again.", login: true });
      } else if (err?.code === "ITEMS_UNAVAILABLE") {
        setError({
          text: "Some books in your cart are no longer available, so nothing was ordered. We removed them from your cart. Please check it and try again.",
        });
        await refreshCart();
      } else if (err?.code === "EMPTY_CART") {
        setError({ text: "Your cart is empty." });
        await refreshCart();
      } else if (err?.status === 404) {
        setError({ text: "That address could not be found. Please choose another address." });
        addr.reload();
      } else if (err?.status === 0) {
        setError({
          text: `${err.message} If your order did go through, pressing Place order again is safe and will not create a second order.`,
        });
      } else {
        setError({ text: err?.message ?? "Something went wrong. Please try again." });
      }
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="address-heading">
        <h2 id="address-heading" className="font-serif text-xl font-bold">
          Delivery address
        </h2>

        {showForm ? (
          <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
            {addresses.length === 0 && (
              <p className="mb-4 text-sm text-muted">Add the address where you would like your books delivered.</p>
            )}
            <AddressForm
              key="checkout-new"
              canSetDefault={addresses.length > 0}
              onSubmit={createAddress}
              onCancel={addresses.length > 0 ? () => setAdding(false) : undefined}
              submitLabel="Save and use this address"
              busyLabel="Saving…"
            />
          </div>
        ) : (
          <>
            <fieldset className="mt-3">
              <legend className="sr-only">Choose where to deliver your books</legend>
              <ul className="space-y-3">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                        chosen === a.id ? "border-brand bg-brand/5" : "border-line bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryAddress"
                        value={a.id}
                        checked={chosen === a.id}
                        onChange={() => setSelectedId(a.id)}
                        className="mt-1 h-4 w-4 accent-brand"
                      />
                      <div className="min-w-0 flex-1">
                        <AddressText address={a} />
                        {a.isDefault && (
                          <span className="mt-2 inline-block rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand-dark">
                            Default
                          </span>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <button type="button" onClick={() => setAdding(true)} className="font-medium text-brand underline">
                Add a new address
              </button>
              <Link href="/addresses" className="font-medium text-brand underline">
                Manage addresses
              </Link>
            </div>
          </>
        )}
      </section>

      <aside aria-labelledby="summary-heading" className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h2 id="summary-heading" className="font-serif text-xl font-bold">
          Order summary
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {cart.items.map(({ book }) => (
            <li key={book.id} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">{book.title}</span>
              <span className="shrink-0 font-medium">{formatPrice(book.priceMinor)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between gap-3 border-t border-line pt-3">
          <span>Items ({cart.count})</span>
          <span className="font-bold">{formatPrice(cart.subtotalMinor)}</span>
        </p>
        <p className="mt-3 text-sm text-muted">
          Shipping is added and the final total is worked out by BookBack when you place the order. You will see the
          exact amounts on your order page.
        </p>

        {error && (
          <div className="mt-4">
            <Alert>
              {error.text}
              {error.login && (
                <>
                  {" "}
                  <Link href="/login?next=%2Fcheckout" className="font-medium underline">
                    Log in
                  </Link>
                </>
              )}
            </Alert>
          </div>
        )}

        <button
          type="button"
          onClick={placeOrder}
          disabled={placing || !chosen}
          className={`mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON}`}
        >
          {placing ? "Placing order…" : "Place order"}
        </button>
        {!chosen && <p className="mt-2 text-sm text-muted">Choose or add a delivery address to continue.</p>}

        <p className="mt-4 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-muted">
          No payment is taken yet. Your order is saved as unpaid and the books are held for you. You can cancel it from
          your orders page.
        </p>
      </aside>
    </div>
  );
}
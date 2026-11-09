import { request } from "@playwright/test";
import { API, PASSWORD } from "./helpers";

// A logged-in API connection for one person. It keeps its own login cookie.
export async function apiLogin(email) {
  const api = await request.newContext();
  const res = await api.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } });
  if (res.status() !== 200) throw new Error(`Could not log in ${email}: HTTP ${res.status()}`);
  return api;
}

export async function createListing(sellerApi, title) {
  const res = await sellerApi.post(`${API}/api/books`, {
    data: {
      title,
      author: "F. Tester",
      category: "Physics",
      audience: "school",
      condition: "good",
      priceMinor: 12000,
    },
  });
  if (res.status() !== 201) throw new Error(`Could not create a listing: HTTP ${res.status()}`);
  return (await res.json()).data.id;
}

export async function approveListing(adminApi, id) {
  const res = await adminApi.patch(`${API}/api/admin/books/${id}`, { data: { moderationState: "approved" } });
  if (res.status() !== 200) throw new Error(`Could not approve the listing: HTTP ${res.status()}`);
}

// Saves an address, puts the book in the cart and places the order. Returns the order id.
export async function placeOrderFor(buyerApi, bookId) {
  const address = await buyerApi.post(`${API}/api/addresses`, {
    data: {
      recipientName: "E2E Receiver",
      phone: "98765 43210",
      line1: "12 Test Street",
      city: "Jalandhar",
      state: "Punjab",
      postalCode: "144001",
      country: "IN",
    },
  });
  if (address.status() !== 201) throw new Error(`Could not save an address: HTTP ${address.status()}`);
  const addressId = (await address.json()).data.id;

  const cart = await buyerApi.post(`${API}/api/cart/items`, { data: { bookId } });
  if (cart.status() !== 200) throw new Error(`Could not add to the cart: HTTP ${cart.status()}`);

  const order = await buyerApi.post(`${API}/api/orders`, { data: { addressId } });
  if (order.status() !== 201) throw new Error(`Could not place the order: HTTP ${order.status()}`);
  return (await order.json()).data.id;
}
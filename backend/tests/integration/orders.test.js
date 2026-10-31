import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book, Cart, Wishlist, Address, Order, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) {
    const inIds = () => mongoose.trusted({ $in: ids });
    await Order.deleteMany({ buyerId: inIds() });
    await Book.deleteMany({ sellerId: inIds() });
    await Cart.deleteMany({ userId: inIds() });
    await Wishlist.deleteMany({ userId: inIds() });
    await Address.deleteMany({ userId: inIds() });
    await Session.deleteMany({ userId: inIds() });
  }
  await User.deleteMany({ email: TEST_EMAIL });
}

async function loginAs(email) {
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: PASSWORD })
    .expect(201);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  const user = await User.findOne({ email });
  return { agent, id: String(user._id) };
}

let userCounter = 0;
const freshUser = (label) => loginAs(`order7.${label}.${++userCounter}@example.test`);

let bookCounter = 0;
const makeBook = (sellerId, patch = {}) =>
  Book.create({
    sellerId,
    title: `Order7 Book ${++bookCounter}`,
    author: "A. Author",
    category: "Physics",
    audience: "school",
    condition: "good",
    priceMinor: 10000,
    moderationState: "approved",
    status: "active",
    ...patch,
  });

const validAddress = () => ({
  recipientName: "Alfa Buyer",
  phone: "+91 98765 43210",
  line1: "12 Test Street",
  city: "Testville",
  state: "Test State",
  postalCode: "123456",
  country: "IN",
});

// A buyer with a saved address and the given books in the cart, all set up through the real API.
async function readyBuyer(label, books = []) {
  const buyer = await freshUser(label);
  const address = (await buyer.agent.post("/api/addresses").send(validAddress()).expect(201)).body.data;
  for (const book of books) {
    await buyer.agent.post("/api/cart/items").send({ bookId: String(book._id) }).expect(200);
  }
  return { ...buyer, addressId: address.id };
}

function placeOrder(buyer, extra = {}, headers = {}) {
  let req = buyer.agent.post("/api/orders");
  for (const [name, value] of Object.entries(headers)) req = req.set(name, value);
  return req.send({ addressId: buyer.addressId, ...extra });
}

describe("orders API", () => {
  let bravo; // the seller

  beforeAll(async () => {
    await connectDb();
    await Promise.all([
      User.init(), Book.init(), Cart.init(), Wishlist.init(), Address.init(), Order.init(), Session.init(),
    ]);
    await cleanup();
    bravo = await freshUser("seller");
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("requires login for every order route", async () => {
    const id = String(new mongoose.Types.ObjectId());
    expect((await request(app).post("/api/orders").send({ addressId: id })).status).toBe(401);
    expect((await request(app).get("/api/orders")).status).toBe(401);
    expect((await request(app).get(`/api/orders/${id}`)).status).toBe(401);
  });

  it("creates an order from the cart with server-side totals, ignoring tampered values", async () => {
    const one = await makeBook(bravo.id, { priceMinor: 25000, title: "Order7 One" });
    const two = await makeBook(bravo.id, { priceMinor: 15000, title: "Order7 Two" });
    const buyer = await readyBuyer("create", [one, two]);

    const res = await placeOrder(buyer, {
      totalMinor: 1,
      subtotalMinor: 1,
      shippingMinor: 0,
      status: "delivered",
      paymentStatus: "paid",
      buyerId: bravo.id,
      items: [{ bookId: String(one._id), unitPriceMinor: 1 }],
    });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order).toMatchObject({
      status: "placed",
      paymentStatus: "unpaid",
      subtotalMinor: 40000,
      shippingMinor: 4000,
      totalMinor: 44000,
      currency: "INR",
    });
    expect(order.orderNumber).toMatch(/^BB-[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(order.items.map((i) => i.unitPriceMinor).sort()).toEqual([15000, 25000]);
    expect(order.shippingAddress).toMatchObject({ recipientName: "Alfa Buyer", city: "Testville", postalCode: "123456" });
    expect(JSON.stringify(res.body)).not.toMatch(/sellerId|idempotencyKey|passwordHash/);

    const stored = await Order.findById(order.id);
    expect(String(stored.buyerId)).toBe(buyer.id);
    expect(stored.sellerIds.map(String)).toEqual([bravo.id]);
    expect((await Book.findById(one._id)).status).toBe("reserved");
    expect((await Book.findById(two._id)).status).toBe("reserved");
    expect((await Cart.findOne({ userId: buyer.id })).items).toHaveLength(0);

    // The order is a snapshot: later changes to the book or the address do not alter it.
    await Book.updateOne({ _id: one._id }, { $set: { title: "Changed", priceMinor: 1 } });
    await Address.deleteMany({ userId: buyer.id });
    const again = await buyer.agent.get(`/api/orders/${order.id}`);
    expect(again.status).toBe(200);
    expect(again.body.data.items.map((i) => i.title).sort()).toEqual(["Order7 One", "Order7 Two"]);
    expect(again.body.data.totalMinor).toBe(44000);
    expect(again.body.data.shippingAddress.city).toBe("Testville");
  });

  it("uses the price in the database at checkout, not the price when the book was added", async () => {
    const book = await makeBook(bravo.id, { priceMinor: 10000 });
    const buyer = await readyBuyer("reprice", [book]);
    await Book.updateOne({ _id: book._id }, { $set: { priceMinor: 30000 } });
    const res = await placeOrder(buyer);
    expect(res.status).toBe(201);
    expect(res.body.data.subtotalMinor).toBe(30000);
    expect(res.body.data.totalMinor).toBe(34000);
  });

  it("rejects an address that belongs to someone else and changes nothing", async () => {
    const book = await makeBook(bravo.id);
    const alfa = await readyBuyer("foreign-a", [book]);
    const charlie = await readyBuyer("foreign-c");

    const res = await alfa.agent.post("/api/orders").send({ addressId: charlie.addressId });
    expect(res.status).toBe(404);
    const unknown = await alfa.agent.post("/api/orders").send({ addressId: String(new mongoose.Types.ObjectId()) });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toBe(res.body.error.message);

    expect(await Order.countDocuments({ buyerId: alfa.id })).toBe(0);
    expect((await Book.findById(book._id)).status).toBe("active");
    expect((await Cart.findOne({ userId: alfa.id })).items).toHaveLength(1);
  });

  it("answers an empty cart and malformed bodies with controlled 400s", async () => {
    const buyer = await readyBuyer("empty");
    const empty = await placeOrder(buyer);
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("EMPTY_CART");

    const bad = [{}, { addressId: "nope" }, { addressId: 123 }, { addressId: ["x"] }, { addressId: { $ne: null } }];
    for (const body of bad) {
      const res = await buyer.agent.post("/api/orders").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("creates no partial order when one book in the cart is no longer available", async () => {
    const fine = await makeBook(bravo.id);
    const gone = await makeBook(bravo.id);
    const buyer = await readyBuyer("partial", [fine, gone]);
    await Book.updateOne({ _id: gone._id }, { $set: { status: "sold" } });

    const res = await placeOrder(buyer);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ITEMS_UNAVAILABLE");
    expect(res.body.error.details.map((d) => d.bookId)).toEqual([String(gone._id)]);

    expect(await Order.countDocuments({ buyerId: buyer.id })).toBe(0);
    expect((await Book.findById(fine._id)).status).toBe("active"); // not reserved
    expect((await Cart.findOne({ userId: buyer.id })).items).toHaveLength(2); // cart untouched
  });

  it("lets only one of several simultaneous buyers get a one-copy book", { timeout: 60000 }, async () => {
    const book = await makeBook(bravo.id, { priceMinor: 20000 });
    const buyers = [];
    for (let i = 0; i < 4; i++) buyers.push(await readyBuyer(`race-${i}`, [book]));

    const results = await Promise.all(buyers.map((buyer) => placeOrder(buyer)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    for (const loser of results.filter((r) => r.status === 409)) {
      expect(loser.body.error.code).toBe("ITEMS_UNAVAILABLE");
    }
    expect(await Order.countDocuments({ "items.bookId": book._id })).toBe(1);
    expect((await Book.findById(book._id)).status).toBe("reserved");
  });

  it("returns the original order when a request is retried with the same Idempotency-Key", { timeout: 60000 }, async () => {
    const book = await makeBook(bravo.id);
    const buyer = await readyBuyer("idem", [book]);
    const headers = { "Idempotency-Key": "order7-key-0001" };

    const first = await placeOrder(buyer, {}, headers);
    const second = await placeOrder(buyer, {}, headers);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber);
    expect(await Order.countDocuments({ buyerId: buyer.id })).toBe(1);

    // Without a key, the same retry finds an empty cart.
    expect((await placeOrder(buyer)).status).toBe(400);

    // Five identical requests at once still produce exactly one order.
    const other = await makeBook(bravo.id);
    const racer = await readyBuyer("idem-race", [other]);
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder(racer, {}, { "Idempotency-Key": "order7-burst-01" }))
    );
    expect(burst.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(burst.map((r) => r.body.data.id)).size).toBe(1);
    expect(await Order.countDocuments({ buyerId: racer.id })).toBe(1);
  });

  it("rejects malformed Idempotency-Key headers", async () => {
    const book = await makeBook(bravo.id);
    const buyer = await readyBuyer("idem-bad", [book]);
    for (const key of ["short", "has spaces in it!", "x".repeat(65)]) {
      const res = await placeOrder(buyer, {}, { "Idempotency-Key": key });
      expect(res.status, key).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await Order.countDocuments({ buyerId: buyer.id })).toBe(0);
    expect((await Book.findById(book._id)).status).toBe("active");
  });

  it("shows an order only to its buyer", async () => {
    const book = await makeBook(bravo.id);
    const alfa = await readyBuyer("access-a", [book]);
    const order = (await placeOrder(alfa)).body.data;
    const charlie = await freshUser("access-c");

    const list = await alfa.agent.get("/api/orders");
    expect(list.status).toBe(200);
    expect(list.body.data.map((o) => o.id)).toEqual([order.id]);
    expect(list.body.meta).toMatchObject({ page: 1, total: 1 });
    expect((await alfa.agent.get(`/api/orders/${order.id}`)).status).toBe(200);

    expect((await charlie.agent.get("/api/orders")).body.data).toEqual([]);
    const foreign = await charlie.agent.get(`/api/orders/${order.id}`);
    const unknown = await charlie.agent.get(`/api/orders/${new mongoose.Types.ObjectId()}`);
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error.message).toBe(unknown.body.error.message);

    // The seller does not get the buyer's address through this route (seller view comes later).
    expect((await bravo.agent.get(`/api/orders/${order.id}`)).status).toBe(404);

    expect((await alfa.agent.get("/api/orders/abc")).status).toBe(400);
    expect((await alfa.agent.get("/api/orders?limit=1000")).status).toBe(400);
  });
});
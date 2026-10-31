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
const freshUser = (label) => loginAs(`dash8.${label}.${++userCounter}@example.test`);

let bookCounter = 0;
const makeBook = (sellerId, patch = {}) =>
  Book.create({
    sellerId,
    title: `Dash8 Book ${++bookCounter}`,
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

async function readyBuyer(label, books = []) {
  const buyer = await freshUser(label);
  const address = (await buyer.agent.post("/api/addresses").send(validAddress()).expect(201)).body.data;
  for (const book of books) {
    await buyer.agent.post("/api/cart/items").send({ bookId: String(book._id) }).expect(200);
  }
  return { ...buyer, addressId: address.id };
}

const placeOrder = (buyer) => buyer.agent.post("/api/orders").send({ addressId: buyer.addressId });
const cancelPath = (order) => `/api/orders/${order.id}/cancel`;

describe("order dashboard API", () => {
  let bravo; // seller
  let delta; // second seller

  beforeAll(async () => {
    await connectDb();
    await Promise.all([
      User.init(), Book.init(), Cart.init(), Wishlist.init(), Address.init(), Order.init(), Session.init(),
    ]);
    await cleanup();
    bravo = await freshUser("seller-b");
    delta = await freshUser("seller-d");
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("requires login for the new routes", async () => {
    const id = String(new mongoose.Types.ObjectId());
    expect((await request(app).post(`/api/orders/${id}/cancel`)).status).toBe(401);
    expect((await request(app).get("/api/seller/orders")).status).toBe(401);
    expect((await request(app).get(`/api/seller/orders/${id}`)).status).toBe(401);
  });

  it("records a timeline, shows whether an order can be cancelled, and handles older orders", async () => {
    const book = await makeBook(bravo.id);
    const buyer = await readyBuyer("timeline", [book]);
    const res = await placeOrder(buyer);
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.timeline.map((e) => e.status)).toEqual(["placed"]);
    expect(Number.isNaN(new Date(order.timeline[0].at).getTime())).toBe(false);
    expect(order.cancellable).toBe(true);

    // An order saved before timelines existed still shows "placed".
    await Order.updateOne({ _id: order.id }, { $unset: { timeline: "" } });
    const legacy = await buyer.agent.get(`/api/orders/${order.id}`);
    expect(legacy.body.data.timeline.map((e) => e.status)).toEqual(["placed"]);
  });

  it("lets the buyer cancel an unpaid order, releases the books and records it", async () => {
    const one = await makeBook(bravo.id);
    const two = await makeBook(bravo.id);
    const buyer = await readyBuyer("cancel", [one, two]);
    const order = (await placeOrder(buyer)).body.data;
    expect((await Book.findById(one._id)).status).toBe("reserved");

    const res = await buyer.agent.post(cancelPath(order));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "cancelled", cancellable: false, totalMinor: order.totalMinor });
    expect(res.body.data.timeline.map((e) => e.status)).toEqual(["placed", "cancelled"]);
    for (const book of [one, two]) expect((await Book.findById(book._id)).status).toBe("active");

    const again = await buyer.agent.post(cancelPath(order)); // repeating is safe
    expect(again.status).toBe(200);
    expect(again.body.data.timeline).toHaveLength(2);

    // The freed book can be bought by someone else.
    const other = await readyBuyer("cancel-rebuy", [one]);
    expect((await placeOrder(other)).status).toBe(201);
  });

  it("does not let another user cancel an order (IDOR)", async () => {
    const book = await makeBook(bravo.id);
    const alfa = await readyBuyer("cancel-a", [book]);
    const order = (await placeOrder(alfa)).body.data;
    const charlie = await freshUser("cancel-c");

    const foreign = await charlie.agent.post(cancelPath(order));
    const unknown = await charlie.agent.post(`/api/orders/${new mongoose.Types.ObjectId()}/cancel`);
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error.message).toBe(unknown.body.error.message);
    expect((await charlie.agent.post("/api/orders/not-an-id/cancel")).status).toBe(400);

    expect((await Order.findById(order.id)).status).toBe("placed");
    expect((await Book.findById(book._id)).status).toBe("reserved");
  });

  it("refuses to cancel once an order has shipped or been paid", async () => {
    const cases = [
      ["shipped", { status: "shipped" }],
      ["paid", { paymentStatus: "paid" }],
    ];
    for (const [label, patch] of cases) {
      const book = await makeBook(bravo.id);
      const buyer = await readyBuyer(`late-${label}`, [book]);
      const order = (await placeOrder(buyer)).body.data;
      await Order.updateOne({ _id: order.id }, { $set: patch });

      const res = await buyer.agent.post(cancelPath(order));
      expect(res.status, label).toBe(409);
      expect(res.body.error.code).toBe("ORDER_NOT_CANCELLABLE");
      expect((await Book.findById(book._id)).status).toBe("reserved");
    }
  });

  it("handles simultaneous cancel requests safely", { timeout: 120000 }, async () => {
    const book = await makeBook(bravo.id);
    const buyer = await readyBuyer("cancel-race", [book]);
    const order = (await placeOrder(buyer)).body.data;

    const results = await Promise.all(Array.from({ length: 3 }, () => buyer.agent.post(cancelPath(order))));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

    const stored = await Order.findById(order.id);
    expect(stored.status).toBe("cancelled");
    expect(stored.timeline.filter((e) => e.status === "cancelled")).toHaveLength(1);
    expect((await Book.findById(book._id)).status).toBe("active");
  });

  describe("seller view", () => {
    let buyer;
    let order;

    beforeAll(async () => {
      const mine = await makeBook(bravo.id, { priceMinor: 20000, title: "Dash8 Bravo Book" });
      const theirs = await makeBook(delta.id, { priceMinor: 30000, title: "Dash8 Delta Book" });
      buyer = await readyBuyer("multi", [mine, theirs]);
      order = (await placeOrder(buyer)).body.data;
    });

    it("shows each seller only their own items and the minimum shipping details", async () => {
      const list = await bravo.agent.get("/api/seller/orders?limit=50");
      expect(list.status).toBe(200);
      expect(list.body.data.map((o) => o.id)).toContain(order.id);

      const detail = await bravo.agent.get(`/api/seller/orders/${order.id}`);
      expect(detail.status).toBe(200);
      const data = detail.body.data;
      expect(data).toMatchObject({ orderNumber: order.orderNumber, status: "placed", paymentStatus: "unpaid" });
      expect(data.items.map((i) => i.title)).toEqual(["Dash8 Bravo Book"]);
      expect(data.itemsSubtotalMinor).toBe(20000);
      expect(data.shipTo).toMatchObject({
        recipientName: "Alfa Buyer",
        line1: "12 Test Street",
        city: "Testville",
        postalCode: "123456",
      });
      expect(data.shipTo).not.toHaveProperty("phone");

      const text = JSON.stringify(detail.body);
      expect(text).not.toContain("Dash8 Delta Book");
      expect(text).not.toContain(buyer.id);
      expect(text).not.toMatch(/"(phone|email|buyerId|sellerId|totalMinor|shippingMinor)"/);
      const other = await delta.agent.get(`/api/seller/orders/${order.id}`);
      expect(other.body.data.items.map((i) => i.title)).toEqual(["Dash8 Delta Book"]);
      expect(other.body.data.itemsSubtotalMinor).toBe(30000);
    });

    it("hides the order from users who are not a seller on it", async () => {
      const charlie = await freshUser("not-seller");
      expect((await charlie.agent.get("/api/seller/orders")).body.data).toEqual([]);

      const foreign = await charlie.agent.get(`/api/seller/orders/${order.id}`);
      const unknown = await charlie.agent.get(`/api/seller/orders/${new mongoose.Types.ObjectId()}`);
      expect(foreign.status).toBe(404);
      expect(unknown.status).toBe(404);
      expect(foreign.body.error.message).toBe(unknown.body.error.message);

      // The buyer is not a seller on their own order.
      expect((await buyer.agent.get(`/api/seller/orders/${order.id}`)).status).toBe(404);
      expect((await charlie.agent.get("/api/seller/orders/not-an-id")).status).toBe(400);
    });

    it("hides the delivery address once the buyer cancels", async () => {
      await buyer.agent.post(cancelPath(order)).expect(200);
      const after = await bravo.agent.get(`/api/seller/orders/${order.id}`);
      expect(after.status).toBe(200);
      expect(after.body.data.status).toBe("cancelled");
      expect(after.body.data.shipTo).toBeNull();
      expect(after.body.data.timeline.map((e) => e.status)).toEqual(["placed", "cancelled"]);
    });
  });
});
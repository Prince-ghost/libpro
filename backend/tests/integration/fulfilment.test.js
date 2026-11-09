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
const freshUser = (label) => loginAs(`ful12.${label}.${++userCounter}@example.test`);

let bookCounter = 0;
const makeBook = (sellerId, patch = {}) =>
  Book.create({
    sellerId,
    title: `Ful12 Book ${++bookCounter}`,
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

async function readyBuyer(label, books) {
  const buyer = await freshUser(label);
  const address = (await buyer.agent.post("/api/addresses").send(validAddress()).expect(201)).body.data;
  for (const book of books) {
    await buyer.agent.post("/api/cart/items").send({ bookId: String(book._id) }).expect(200);
  }
  return { ...buyer, addressId: address.id };
}

// One book per seller, all in one order.
async function newOrder(label, sellers) {
  const books = [];
  for (const seller of sellers) books.push(await makeBook(seller.id));
  const buyer = await readyBuyer(label, books);
  const res = await buyer.agent.post("/api/orders").send({ addressId: buyer.addressId });
  expect(res.status).toBe(201);
  return { books, buyer, orderId: res.body.data.id };
}

const ship = (seller, orderId) => seller.agent.post(`/api/seller/orders/${orderId}/ship`);
const received = (buyer, orderId, bookId) => buyer.agent.post(`/api/orders/${orderId}/items/${bookId}/received`);
const sellerView = (seller, orderId) => seller.agent.get(`/api/seller/orders/${orderId}`);
const buyerView = (buyer, orderId) => buyer.agent.get(`/api/orders/${orderId}`);
const itemFor = (res, book) => res.body.data.items.find((i) => i.bookId === String(book._id));

describe("order fulfilment", () => {
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
    expect((await request(app).post(`/api/seller/orders/${id}/ship`)).status).toBe(401);
    expect((await request(app).post(`/api/orders/${id}/items/${id}/received`)).status).toBe(401);
  });

  it("lets a seller ship their books, repeats are safe, and the buyer sees it", async () => {
    const { books, buyer, orderId } = await newOrder("ship", [bravo]);
    expect((await sellerView(bravo, orderId)).body.data.canShip).toBe(true);

    const res = await ship(bravo, orderId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "shipped", canShip: false });
    expect(res.body.data.items[0]).toMatchObject({ fulfilment: "shipped" });
    expect(res.body.data.items[0].shippedAt).toBeTruthy();
    expect(res.body.data.timeline.map((e) => e.status)).toEqual(["placed", "shipped"]);
    expect(JSON.stringify(res.body)).not.toMatch(/"(phone|email|buyerId|sellerId|totalMinor|shippingMinor)"/);

    const mine = await buyerView(buyer, orderId);
    expect(mine.body.data).toMatchObject({ status: "shipped", cancellable: false });
    expect(mine.body.data.items[0].fulfilment).toBe("shipped");
    expect((await Book.findById(books[0]._id)).status).toBe("reserved"); // sold only once the buyer confirms

    const again = await ship(bravo, orderId);
    expect(again.status).toBe(200);
    expect(again.body.data.timeline).toHaveLength(2);
  });

  it("lets only a seller on the order ship it", async () => {
    const { buyer, orderId } = await newOrder("only-seller", [bravo]);
    const stranger = await freshUser("stranger");
    expect((await ship(buyer, orderId)).status).toBe(404);
    expect((await ship(stranger, orderId)).status).toBe(404);
    expect((await ship(delta, orderId)).status).toBe(404);
    expect((await ship(bravo, String(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect((await ship(bravo, "not-an-id")).status).toBe(400);
    const stored = await Order.findById(orderId);
    expect(stored.status).toBe("placed");
    expect(stored.items[0].fulfilment).toBe("pending");
  });

  it("refuses to ship a cancelled order", async () => {
    const { buyer, orderId } = await newOrder("cancelled", [bravo]);
    await buyer.agent.post(`/api/orders/${orderId}/cancel`).expect(200);
    const res = await ship(bravo, orderId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_CANCELLED");
    expect((await Order.findById(orderId)).items[0].fulfilment).toBe("pending");
  });

  it("stops the buyer cancelling once a book has shipped", async () => {
    const { books, buyer, orderId } = await newOrder("no-cancel", [bravo]);
    await ship(bravo, orderId).expect(200);
    const res = await buyer.agent.post(`/api/orders/${orderId}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_NOT_CANCELLABLE");
    expect((await Book.findById(books[0]._id)).status).toBe("reserved");
  });

  it("lets the buyer confirm receipt: the book becomes sold and the order delivered", async () => {
    const { books, buyer, orderId } = await newOrder("receive", [bravo]);
    await ship(bravo, orderId).expect(200);

    const res = await received(buyer, orderId, books[0]._id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "delivered", cancellable: false });
    expect(res.body.data.items[0].fulfilment).toBe("delivered");
    expect(res.body.data.items[0].deliveredAt).toBeTruthy();
    expect(res.body.data.timeline.map((e) => e.status)).toEqual(["placed", "shipped", "delivered"]);
    expect((await Book.findById(books[0]._id)).status).toBe("sold");

    const again = await received(buyer, orderId, books[0]._id);
    expect(again.status).toBe(200);
    expect(again.body.data.timeline).toHaveLength(3);

    const seller = await sellerView(bravo, orderId);
    expect(seller.body.data.items[0].fulfilment).toBe("delivered");
    expect(seller.body.data.canShip).toBe(false);
  });

  it("enforces who may confirm receipt and when", async () => {
    const { books, buyer, orderId } = await newOrder("rules", [bravo]);
    const other = await freshUser("rules-other");

    const early = await received(buyer, orderId, books[0]._id);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("NOT_SHIPPED");

    await ship(bravo, orderId).expect(200);
    expect((await received(other, orderId, books[0]._id)).status).toBe(404);
    expect((await received(bravo, orderId, books[0]._id)).status).toBe(404); // the seller cannot confirm for the buyer
    expect((await received(buyer, orderId, String(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect((await received(buyer, "not-an-id", books[0]._id)).status).toBe(400);
    expect((await received(buyer, orderId, "not-an-id")).status).toBe(400);
    expect((await Book.findById(books[0]._id)).status).toBe("reserved");
  });

  it("handles an order with books from two sellers", { timeout: 180000 }, async () => {
    const { books, buyer, orderId } = await newOrder("multi", [bravo, delta]);
    const [bookB, bookD] = books;

    await ship(bravo, orderId).expect(200);
    const afterFirst = await buyerView(buyer, orderId);
    expect(afterFirst.body.data.status).toBe("shipped");
    expect(itemFor(afterFirst, bookB).fulfilment).toBe("shipped");
    expect(itemFor(afterFirst, bookD).fulfilment).toBe("pending");
    expect((await sellerView(delta, orderId)).body.data.canShip).toBe(true);
    expect((await buyer.agent.post(`/api/orders/${orderId}/cancel`)).status).toBe(409);

    await ship(bravo, orderId).expect(200); // repeating never touches the other seller's book
    const stored = await Order.findById(orderId);
    expect(stored.items.find((i) => String(i.bookId) === String(bookD._id)).fulfilment).toBe("pending");

    const partial = await received(buyer, orderId, bookB._id);
    expect(partial.body.data.status).toBe("shipped"); // not delivered while the other book is on its way

    await ship(delta, orderId).expect(200);
    const done = await received(buyer, orderId, bookD._id);
    expect(done.body.data.status).toBe("delivered");
    expect(done.body.data.timeline.map((e) => e.status)).toEqual(["placed", "shipped", "delivered"]);
    expect((await Book.findById(bookB._id)).status).toBe("sold");
    expect((await Book.findById(bookD._id)).status).toBe("sold");
  });

  it("copes with sellers shipping at the same moment", { timeout: 180000 }, async () => {
    const { orderId } = await newOrder("race", [bravo, delta]);
    const results = await Promise.all([ship(bravo, orderId), ship(delta, orderId), ship(bravo, orderId)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

    const stored = await Order.findById(orderId);
    expect(stored.items.every((i) => i.fulfilment === "shipped")).toBe(true);
    expect(stored.timeline.filter((e) => e.status === "shipped")).toHaveLength(1);
  });

  it("treats orders from before fulfilment existed as not shipped yet", async () => {
    const { books, buyer, orderId } = await newOrder("legacy", [bravo]);
    await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(orderId) },
      { $unset: { "items.0.fulfilment": "" } }
    );

    const mine = await buyerView(buyer, orderId);
    expect(mine.body.data.items[0].fulfilment).toBe("pending");
    expect((await sellerView(bravo, orderId)).body.data.canShip).toBe(true);

    const res = await ship(bravo, orderId);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].fulfilment).toBe("shipped");
    expect((await received(buyer, orderId, books[0]._id)).status).toBe(200);
  });
});
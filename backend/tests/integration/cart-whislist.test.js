import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book, Cart, Wishlist, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) {
    const inIds = () => mongoose.trusted({ $in: ids });
    await Book.deleteMany({ sellerId: inIds() });
    await Cart.deleteMany({ userId: inIds() });
    await Wishlist.deleteMany({ userId: inIds() });
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
const freshUser = (label) => loginAs(`cart6.${label}.${++userCounter}@example.test`);

let bookCounter = 0;
const bookData = (sellerId, patch = {}) => ({
  sellerId,
  title: `Cart6 Book ${++bookCounter}`,
  author: "A. Author",
  category: "Physics",
  audience: "school",
  condition: "good",
  priceMinor: 10000,
  moderationState: "approved",
  status: "active",
  ...patch,
});
const makeBook = (sellerId, patch) => Book.create(bookData(sellerId, patch));

const CART_ADD = "/api/cart/items";

describe("cart and wishlist API", () => {
  let bravo; // the seller

  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Book.init(), Cart.init(), Wishlist.init(), Session.init()]);
    await cleanup();
    bravo = await loginAs("seller.bravo@example.test");
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  describe("cart", () => {
    it("requires login for every cart route", async () => {
      const id = String(new mongoose.Types.ObjectId());
      expect((await request(app).get("/api/cart")).status).toBe(401);
      expect((await request(app).post(CART_ADD).send({ bookId: id })).status).toBe(401);
      expect((await request(app).delete(`${CART_ADD}/${id}`)).status).toBe(401);
    });

    it("starts empty", async () => {
      const buyer = await freshUser("empty");
      const res = await buyer.agent.get("/api/cart");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ items: [], count: 0, subtotalMinor: 0, currency: "INR" });
      expect(res.body.meta.removed).toEqual([]);
    });

    it("adds a book with the database price and a quantity of one, ignoring client values", async () => {
      const buyer = await freshUser("add");
      const book = await makeBook(bravo.id, { priceMinor: 12345 });
      const res = await buyer.agent
        .post(CART_ADD)
        .send({ bookId: String(book._id), quantity: 99, priceMinor: 1, userId: bravo.id });
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.subtotalMinor).toBe(12345);
      expect(res.body.data.items[0]).toMatchObject({
        quantity: 1,
        book: { id: String(book._id), title: book.title, priceMinor: 12345 },
      });
      expect(res.body.data.items[0].book).not.toHaveProperty("sellerId");
      expect(res.body.data.items[0].book).not.toHaveProperty("moderationState");
      const stored = await Cart.findOne({ userId: buyer.id });
      expect(stored.items).toHaveLength(1);
      expect(stored.items[0].quantity).toBe(1);
    });

    it("adding the same book twice leaves a single line", async () => {
      const buyer = await freshUser("twice");
      const book = await makeBook(bravo.id);
      const first = await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) });
      const second = await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.count).toBe(1);
      expect((await Cart.findOne({ userId: buyer.id })).items).toHaveLength(1);
    });

    it("five simultaneous adds create one cart with one line", async () => {
      const buyer = await freshUser("race");
      const book = await makeBook(bravo.id);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => buyer.agent.post(CART_ADD).send({ bookId: String(book._id) }))
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      const carts = await Cart.find({ userId: buyer.id });
      expect(carts).toHaveLength(1);
      expect(carts[0].items).toHaveLength(1);
    });

    it("does not let you add your own listing", async () => {
      const book = await makeBook(bravo.id);
      const res = await bravo.agent.post(CART_ADD).send({ bookId: String(book._id) });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("OWN_LISTING");
      expect(await Cart.countDocuments({ userId: bravo.id })).toBe(0);
    });

    it("refuses hidden books (404) and sold or reserved books (409)", async () => {
      const buyer = await freshUser("refuse");
      const hidden = [
        await makeBook(bravo.id, { moderationState: "pending" }),
        await makeBook(bravo.id, { moderationState: "rejected" }),
        await makeBook(bravo.id, { status: "archived" }),
      ];
      for (const book of hidden) {
        const res = await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) });
        expect(res.status).toBe(404);
      }
      const unknown = await buyer.agent.post(CART_ADD).send({ bookId: String(new mongoose.Types.ObjectId()) });
      expect(unknown.status).toBe(404);

      for (const status of ["sold", "reserved"]) {
        const book = await makeBook(bravo.id, { status });
        const res = await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("BOOK_UNAVAILABLE");
      }
      expect(await Cart.countDocuments({ userId: buyer.id })).toBe(0);
    });

    it("rejects malformed input with a controlled 400", async () => {
      const buyer = await freshUser("invalid");
      const bad = [{}, { bookId: "nope" }, { bookId: "" }, { bookId: 123 }, { bookId: ["a"] }, { bookId: { $ne: null } }];
      for (const body of bad) {
        const res = await buyer.agent.post(CART_ADD).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
      expect((await buyer.agent.delete(`${CART_ADD}/not-an-id`)).status).toBe(400);
    });

    it("keeps carts isolated between users", async () => {
      const a = await freshUser("iso-a");
      const b = await freshUser("iso-b");
      const book = await makeBook(bravo.id);
      await a.agent.post(CART_ADD).send({ bookId: String(book._id) }).expect(200);

      const theirs = await b.agent.get("/api/cart");
      expect(theirs.body.data.items).toEqual([]);

      const del = await b.agent.delete(`${CART_ADD}/${book._id}`);
      expect(del.status).toBe(200);
      const still = await a.agent.get("/api/cart");
      expect(still.body.data.count).toBe(1);
    });

    it("removes items, and removing again or removing something absent is safe", async () => {
      const buyer = await freshUser("remove");
      const book = await makeBook(bravo.id);
      await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) }).expect(200);

      const first = await buyer.agent.delete(`${CART_ADD}/${book._id}`);
      expect(first.status).toBe(200);
      expect(first.body.data.count).toBe(0);
      expect((await buyer.agent.delete(`${CART_ADD}/${book._id}`)).status).toBe(200);
      expect((await buyer.agent.delete(`${CART_ADD}/${new mongoose.Types.ObjectId()}`)).status).toBe(200);
    });

    it("drops items that can no longer be bought and reports them", async () => {
      const buyer = await freshUser("stale");
      const keep = await makeBook(bravo.id, { priceMinor: 5000 });
      const sold = await makeBook(bravo.id);
      const rejected = await makeBook(bravo.id);
      const deleted = await makeBook(bravo.id);
      for (const book of [keep, sold, rejected, deleted]) {
        await buyer.agent.post(CART_ADD).send({ bookId: String(book._id) }).expect(200);
      }
      await Book.updateOne({ _id: sold._id }, { $set: { status: "sold" } });
      await Book.updateOne({ _id: rejected._id }, { $set: { moderationState: "rejected" } });
      await Book.deleteOne({ _id: deleted._id });

      const res = await buyer.agent.get("/api/cart");
      expect(res.status).toBe(200);
      expect(res.body.data.items.map((i) => i.book.id)).toEqual([String(keep._id)]);
      expect(res.body.data.subtotalMinor).toBe(5000);
      expect(res.body.meta.removed.sort()).toEqual(
        [String(sold._id), String(rejected._id), String(deleted._id)].sort()
      );
      expect((await Cart.findOne({ userId: buyer.id })).items).toHaveLength(1);

      const again = await buyer.agent.get("/api/cart");
      expect(again.body.meta.removed).toEqual([]);
    });

    it("stops a cart growing past its limit but still accepts a repeat add", async () => {
      const buyer = await freshUser("full");
      const books = await Book.insertMany(Array.from({ length: 50 }, () => bookData(bravo.id)));
      await Cart.create({ userId: buyer.id, items: books.map((b) => ({ bookId: b._id })) });

      const extra = await makeBook(bravo.id);
      const full = await buyer.agent.post(CART_ADD).send({ bookId: String(extra._id) });
      expect(full.status).toBe(409);
      expect(full.body.error.code).toBe("CART_FULL");

      const repeat = await buyer.agent.post(CART_ADD).send({ bookId: String(books[0]._id) });
      expect(repeat.status).toBe(200);
      expect((await Cart.findOne({ userId: buyer.id })).items).toHaveLength(50);
    });
  });

  describe("wishlist", () => {
    it("requires login for every wishlist route", async () => {
      const id = String(new mongoose.Types.ObjectId());
      expect((await request(app).get("/api/wishlist")).status).toBe(401);
      expect((await request(app).post(`/api/wishlist/${id}`)).status).toBe(401);
      expect((await request(app).delete(`/api/wishlist/${id}`)).status).toBe(401);
    });

    it("adds a book, repeats are safe, and the list has a safe shape", async () => {
      const buyer = await freshUser("wish-add");
      const book = await makeBook(bravo.id, { priceMinor: 9900 });
      const first = await buyer.agent.post(`/api/wishlist/${book._id}`);
      const second = await buyer.agent.post(`/api/wishlist/${book._id}`);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.count).toBe(1);

      const list = await buyer.agent.get("/api/wishlist");
      const item = list.body.data.items[0];
      expect(item).toMatchObject({ id: String(book._id), title: book.title, priceMinor: 9900 });
      expect(item).not.toHaveProperty("sellerId");
      expect(item).not.toHaveProperty("moderationState");
      expect((await Wishlist.findOne({ userId: buyer.id })).bookIds).toHaveLength(1);
    });

    it("refuses hidden or unknown books and malformed ids", async () => {
      const buyer = await freshUser("wish-hidden");
      const pending = await makeBook(bravo.id, { moderationState: "pending" });
      const archived = await makeBook(bravo.id, { status: "archived" });
      for (const id of [pending._id, archived._id, new mongoose.Types.ObjectId()]) {
        expect((await buyer.agent.post(`/api/wishlist/${id}`)).status).toBe(404);
      }
      expect((await buyer.agent.post("/api/wishlist/not-an-id")).status).toBe(400);
      expect(await Wishlist.countDocuments({ userId: buyer.id })).toBe(0);
    });

    it("shows sold books with their status and hides archived ones", async () => {
      const buyer = await freshUser("wish-status");
      const sold = await makeBook(bravo.id);
      const gone = await makeBook(bravo.id);
      await buyer.agent.post(`/api/wishlist/${sold._id}`).expect(200);
      await buyer.agent.post(`/api/wishlist/${gone._id}`).expect(200);
      await Book.updateOne({ _id: sold._id }, { $set: { status: "sold" } });
      await Book.updateOne({ _id: gone._id }, { $set: { status: "archived" } });

      const list = await buyer.agent.get("/api/wishlist");
      expect(list.body.data.items).toHaveLength(1);
      expect(list.body.data.items[0]).toMatchObject({ id: String(sold._id), status: "sold" });
    });

    it("keeps wishlists isolated between users", async () => {
      const a = await freshUser("wish-iso-a");
      const b = await freshUser("wish-iso-b");
      const book = await makeBook(bravo.id);
      await a.agent.post(`/api/wishlist/${book._id}`).expect(200);

      expect((await b.agent.get("/api/wishlist")).body.data.items).toEqual([]);
      expect((await b.agent.delete(`/api/wishlist/${book._id}`)).status).toBe(200);
      expect((await a.agent.get("/api/wishlist")).body.data.count).toBe(1);
    });

    it("removes books, and removing twice or removing something absent is safe", async () => {
      const buyer = await freshUser("wish-remove");
      const book = await makeBook(bravo.id);
      await buyer.agent.post(`/api/wishlist/${book._id}`).expect(200);

      const first = await buyer.agent.delete(`/api/wishlist/${book._id}`);
      expect(first.status).toBe(200);
      expect(first.body.data.count).toBe(0);
      expect((await buyer.agent.delete(`/api/wishlist/${book._id}`)).status).toBe(200);
      expect((await buyer.agent.delete(`/api/wishlist/${new mongoose.Types.ObjectId()}`)).status).toBe(200);
    });
  });
});
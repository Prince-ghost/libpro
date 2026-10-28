import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) {
    await Book.deleteMany({ sellerId: mongoose.trusted({ $in: ids }) });
    await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
  }
  await User.deleteMany({ email: TEST_EMAIL });
}

async function loginAs(email, role) {
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: PASSWORD })
    .expect(201);
  if (role) await User.updateOne({ email }, { role });
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  const user = await User.findOne({ email });
  return { agent, id: String(user._id) };
}

const validBook = (over = {}) => ({
  title: "Block4 Physics Part 1",
  author: "H. C. Verma",
  category: "Physics",
  audience: "school",
  condition: "good",
  description: "Used, no markings.",
  priceMinor: 25000,
  ...over,
});

async function createBook(agent, over) {
  const res = await agent.post("/api/books").send(validBook(over));
  expect(res.status).toBe(201);
  return res.body.data;
}

const setState = (id, patch) => Book.updateOne({ _id: id }, { $set: patch });

async function approvedBook(owner, title) {
  const book = await createBook(owner.agent, { title });
  await setState(book.id, { moderationState: "approved" });
  return book;
}

describe("books API", () => {
  let bravo;
  let charlie;
  let delta;

  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Book.init(), Session.init()]);
    await cleanup();
    bravo = await loginAs("seller.bravo@example.test");
    charlie = await loginAs("user.charlie@example.test");
    delta = await loginAs("admin.delta@example.test", "admin");
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  describe("create", () => {
    it("requires login", async () => {
      const res = await request(app).post("/api/books").send(validBook());
      expect(res.status).toBe(401);
    });

    it("creates a pending, active listing owned by the session user", async () => {
      const res = await bravo.agent.post("/api/books").send(validBook());
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: "Block4 Physics Part 1",
        priceMinor: 25000,
        currency: "INR",
        status: "active",
        moderationState: "pending",
      });
      const stored = await Book.findById(res.body.data.id);
      expect(String(stored.sellerId)).toBe(bravo.id);
    });

    it("ignores sellerId, status, moderationState, currency and imageKeys sent by the client", async () => {
      const res = await bravo.agent.post("/api/books").send(
        validBook({
          sellerId: charlie.id,
          status: "sold",
          moderationState: "approved",
          currency: "USD",
          imageKeys: ["x"],
        })
      );
      expect(res.status).toBe(201);
      const stored = await Book.findById(res.body.data.id);
      expect(String(stored.sellerId)).toBe(bravo.id);
      expect(stored.status).toBe("active");
      expect(stored.moderationState).toBe("pending");
      expect(stored.currency).toBe("INR");
      expect(stored.imageKeys).toHaveLength(0);
    });

    it("rejects invalid listings with field-level errors", async () => {
      const bad = [
        [{ priceMinor: -5 }, "priceMinor"],
        [{ priceMinor: 10.5 }, "priceMinor"],
        [{ priceMinor: "100" }, "priceMinor"],
        [{ priceMinor: 100000000 }, "priceMinor"],
        [{ title: "   " }, "title"],
        [{ title: "x".repeat(201) }, "title"],
        [{ audience: "nope" }, "audience"],
        [{ condition: "mint" }, "condition"],
      ];
      for (const [patch, field] of bad) {
        const res = await bravo.agent.post("/api/books").send(validBook(patch));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.details.map((d) => d.field)).toContain(field);
      }
      const empty = await bravo.agent.post("/api/books").send({});
      expect(empty.status).toBe(400);
    });

    it("answers oversized and malformed bodies with controlled errors", async () => {
      const big = await bravo.agent.post("/api/books").send(validBook({ description: "x".repeat(20000) }));
      expect(big.status).toBe(413);
      const bad = await bravo.agent
        .post("/api/books")
        .set("Content-Type", "application/json")
        .send("{bad");
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("INVALID_JSON");
    });
  });

  describe("public browse", () => {
    beforeAll(async () => {
      const make = (title, over) => createBook(bravo.agent, { title, ...over });
      await make("Zeta4 Pending");
      const a = await make("Zeta4 Approved A", { priceMinor: 10000, audience: "school", condition: "good", category: "Physics" });
      const b = await make("Zeta4 Approved B", { priceMinor: 30000, audience: "college", condition: "fair", category: "Chemistry" });
      const c = await make("Zeta4 Approved C", { priceMinor: 20000, audience: "college", condition: "like_new", category: "Physics" });
      const sold = await make("Zeta4 Sold");
      const rejected = await make("Zeta4 Rejected");
      const archived = await make("Zeta4 Archived");
      for (const book of [a, b, c, sold, rejected, archived]) {
        await setState(book.id, { moderationState: "approved" });
      }
      await setState(sold.id, { status: "sold" });
      await setState(rejected.id, { moderationState: "rejected" });
      await setState(archived.id, { status: "archived" });
    });

    it("lists only approved, active listings", async () => {
      const res = await request(app).get("/api/books?q=Zeta4&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.data.map((b) => b.title).sort()).toEqual([
        "Zeta4 Approved A",
        "Zeta4 Approved B",
        "Zeta4 Approved C",
      ]);
      expect(res.body.meta.total).toBe(3);
    });

    it("returns a safe public shape with no private fields", async () => {
      const res = await request(app).get("/api/books?q=Zeta4&limit=1");
      const item = res.body.data[0];
      expect(item).not.toHaveProperty("sellerId");
      expect(item).not.toHaveProperty("moderationState");
      expect(item.seller).toEqual({ name: "Test User" });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|example\.test/);
    });

    it("paginates and reports totals", async () => {
      const p1 = await request(app).get("/api/books?q=Zeta4&limit=2&page=1");
      expect(p1.body.data).toHaveLength(2);
      expect(p1.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
      const p2 = await request(app).get("/api/books?q=Zeta4&limit=2&page=2");
      expect(p2.body.data).toHaveLength(1);
    });

    it("rejects invalid query parameters with a controlled 400", async () => {
      const bad = [
        "page=-999&limit=100000",
        "page=abc",
        "page=0",
        "page=1.5",
        "page=1&page=2",
        "limit=51",
        "sort=hacked",
        "audience=nope",
        `q=${"x".repeat(101)}`,
        "minPrice=500&maxPrice=100",
      ];
      for (const qs of bad) {
        const res = await request(app).get(`/api/books?${qs}`);
        expect(res.status, qs).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("sorts only by the allowed keys", async () => {
      const titles = async (sort) =>
        (await request(app).get(`/api/books?q=Zeta4&sort=${sort}`)).body.data.map((b) => b.title);
      expect(await titles("price_asc")).toEqual(["Zeta4 Approved A", "Zeta4 Approved C", "Zeta4 Approved B"]);
      expect(await titles("price_desc")).toEqual(["Zeta4 Approved B", "Zeta4 Approved C", "Zeta4 Approved A"]);
      expect(await titles("newest")).toEqual(["Zeta4 Approved C", "Zeta4 Approved B", "Zeta4 Approved A"]);
    });

    it("filters by audience, condition, category and price", async () => {
      const get = async (qs) =>
        (await request(app).get(`/api/books?q=Zeta4&${qs}`)).body.data.map((b) => b.title).sort();
      expect(await get("audience=college")).toEqual(["Zeta4 Approved B", "Zeta4 Approved C"]);
      expect(await get("condition=like_new")).toEqual(["Zeta4 Approved C"]);
      expect(await get("minPrice=15000&maxPrice=25000")).toEqual(["Zeta4 Approved C"]);
      expect(await get("minPrice=25000")).toEqual(["Zeta4 Approved B"]);
      expect(await get("category=Physics")).toEqual(["Zeta4 Approved A", "Zeta4 Approved C"]);
      expect(await get("category=Physics&audience=college")).toEqual(["Zeta4 Approved C"]);
    });

    it("treats search text as plain text, never as a regex or an operator", async () => {
      const dot = await request(app).get(`/api/books?q=${encodeURIComponent(".*")}`);
      expect(dot.status).toBe(200);
      expect(dot.body.meta.total).toBe(0);
      for (const q of ["(", "[", "\\", "a{1,2", "$ne"]) {
        const res = await request(app).get(`/api/books?q=${encodeURIComponent(q)}`);
        expect(res.status, q).toBe(200);
      }
      const nested = await request(app).get("/api/books?q[$ne]=zzz");
      expect(nested.status).toBe(200);
    });
  });

  describe("book details", () => {
    let pub;
    let pending;
    let archived;
    let sold;

    beforeAll(async () => {
      pub = await approvedBook(bravo, "Detail4 Public");
      pending = await createBook(bravo.agent, { title: "Detail4 Pending" });
      archived = await approvedBook(bravo, "Detail4 Archived");
      await setState(archived.id, { status: "archived" });
      sold = await approvedBook(bravo, "Detail4 Sold");
      await setState(sold.id, { status: "sold" });
    });

    it("shows an approved listing publicly, without private fields", async () => {
      const res = await request(app).get(`/api/books/${pub.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ title: "Detail4 Public", status: "active" });
      expect(res.body.data).not.toHaveProperty("moderationState");
      expect(res.body.data).not.toHaveProperty("sellerId");
      expect(res.body.data.seller).toEqual({ name: "Test User" });
    });

    it("shows a sold listing publicly with its status", async () => {
      const res = await request(app).get(`/api/books/${sold.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("sold");
    });

    it("hides pending and archived listings from the public and from other users", async () => {
      for (const book of [pending, archived]) {
        expect((await request(app).get(`/api/books/${book.id}`)).status).toBe(404);
        expect((await charlie.agent.get(`/api/books/${book.id}`)).status).toBe(404);
      }
    });

    it("lets the owner and an admin see non-public listings with their moderation state", async () => {
      const own = await bravo.agent.get(`/api/books/${pending.id}`);
      expect(own.status).toBe(200);
      expect(own.body.data.moderationState).toBe("pending");
      expect((await delta.agent.get(`/api/books/${pending.id}`)).status).toBe(200);
      const ownArchived = await bravo.agent.get(`/api/books/${archived.id}`);
      expect(ownArchived.status).toBe(200);
      expect(ownArchived.body.data.status).toBe("archived");
    });

    it("answers malformed ids with 400 and hides whether a hidden listing exists", async () => {
      expect((await request(app).get("/api/books/not-an-id")).status).toBe(400);
      expect((await request(app).get("/api/books/123")).status).toBe(400);
      const unknown = await request(app).get(`/api/books/${new mongoose.Types.ObjectId()}`);
      const hidden = await request(app).get(`/api/books/${pending.id}`);
      expect(unknown.status).toBe(404);
      expect(hidden.status).toBe(404);
      expect(hidden.body.error.code).toBe(unknown.body.error.code);
      expect(hidden.body.error.message).toBe(unknown.body.error.message);
    });
  });

  describe("my listings", () => {
    it("requires login", async () => {
      expect((await request(app).get("/api/books/mine")).status).toBe(401);
    });

    it("returns only the caller's own non-archived listings, with moderation state", async () => {
      const mine = await createBook(bravo.agent, { title: "Mine4 Bravo Pending" });
      const gone = await createBook(bravo.agent, { title: "Mine4 Bravo Archived" });
      await setState(gone.id, { status: "archived" });
      await createBook(charlie.agent, { title: "Mine4 Charlie" });

      const res = await bravo.agent.get("/api/books/mine?limit=50");
      expect(res.status).toBe(200);
      const titles = res.body.data.map((b) => b.title);
      expect(titles).toContain("Mine4 Bravo Pending");
      expect(titles).not.toContain("Mine4 Bravo Archived");
      expect(titles).not.toContain("Mine4 Charlie");
      expect(res.body.data.find((b) => b.id === mine.id).moderationState).toBe("pending");

      const theirs = await charlie.agent.get("/api/books/mine?limit=50");
      const theirTitles = theirs.body.data.map((b) => b.title);
      expect(theirTitles).toContain("Mine4 Charlie");
      expect(theirTitles).not.toContain("Mine4 Bravo Pending");
    });
  });

  describe("update", () => {
    it("requires login", async () => {
      const book = await createBook(bravo.agent, { title: "Edit4 Anon" });
      const res = await request(app).patch(`/api/books/${book.id}`).send({ title: "x" });
      expect(res.status).toBe(401);
    });

    it("lets the owner edit, keeps untouched fields, and sends the listing back to moderation", async () => {
      const book = await approvedBook(bravo, "Edit4 Original");
      const res = await bravo.agent
        .patch(`/api/books/${book.id}`)
        .send({ title: "Edit4 Changed", priceMinor: 22000 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        title: "Edit4 Changed",
        priceMinor: 22000,
        description: "Used, no markings.",
        moderationState: "pending",
      });
      const publicList = await request(app).get("/api/books?q=Edit4");
      expect(publicList.body.data.map((b) => b.title)).not.toContain("Edit4 Changed");
    });

    it("ignores sellerId, status, moderationState and currency in an edit", async () => {
      const book = await approvedBook(bravo, "Edit4 Whitelist");
      const res = await bravo.agent.patch(`/api/books/${book.id}`).send({
        title: "Edit4 Whitelist Edited",
        sellerId: charlie.id,
        status: "sold",
        moderationState: "approved",
        currency: "USD",
      });
      expect(res.status).toBe(200);
      const stored = await Book.findById(book.id);
      expect(stored.title).toBe("Edit4 Whitelist Edited");
      expect(String(stored.sellerId)).toBe(bravo.id);
      expect(stored.status).toBe("active");
      expect(stored.moderationState).toBe("pending");
      expect(stored.currency).toBe("INR");
    });

    it("rejects empty and invalid edits without changing anything", async () => {
      const book = await createBook(bravo.agent, { title: "Edit4 Validation" });
      const empty = await bravo.agent.patch(`/api/books/${book.id}`).send({});
      expect(empty.status).toBe(400);
      expect(empty.body.error.code).toBe("VALIDATION_ERROR");
      const bad = await bravo.agent.patch(`/api/books/${book.id}`).send({ priceMinor: -1 });
      expect(bad.status).toBe(400);
      expect((await Book.findById(book.id)).priceMinor).toBe(25000);
    });

    it("does not let another user edit the listing (IDOR)", async () => {
      const book = await approvedBook(bravo, "Edit4 Protected");
      const res = await charlie.agent.patch(`/api/books/${book.id}`).send({ title: "Hacked" });
      expect(res.status).toBe(404);
      const stored = await Book.findById(book.id);
      expect(stored.title).toBe("Edit4 Protected");
      expect(stored.moderationState).toBe("approved");
    });

    it("lets an admin edit without resetting approval", async () => {
      const book = await approvedBook(bravo, "Edit4 Admin");
      const res = await delta.agent.patch(`/api/books/${book.id}`).send({ title: "Edit4 Admin Fixed" });
      expect(res.status).toBe(200);
      const stored = await Book.findById(book.id);
      expect(stored.title).toBe("Edit4 Admin Fixed");
      expect(stored.moderationState).toBe("approved");
    });

    it("locks reserved and sold listings", async () => {
      for (const status of ["reserved", "sold"]) {
        const book = await createBook(bravo.agent, { title: `Edit4 ${status}` });
        await setState(book.id, { status });
        const res = await bravo.agent.patch(`/api/books/${book.id}`).send({ title: "Nope" });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("BOOK_LOCKED");
        expect((await Book.findById(book.id)).title).toBe(`Edit4 ${status}`);
      }
    });

    it("answers malformed and unknown ids safely", async () => {
      expect((await bravo.agent.patch("/api/books/not-an-id").send({ title: "x" })).status).toBe(400);
      const unknown = await bravo.agent
        .patch(`/api/books/${new mongoose.Types.ObjectId()}`)
        .send({ title: "x" });
      expect(unknown.status).toBe(404);
    });
  });

  describe("archive (delete)", () => {
    it("requires login", async () => {
      const book = await createBook(bravo.agent, { title: "Del4 Anon" });
      expect((await request(app).delete(`/api/books/${book.id}`)).status).toBe(401);
    });

    it("does not let another user archive the listing (IDOR)", async () => {
      const book = await approvedBook(bravo, "Del4 Protected");
      const res = await charlie.agent.delete(`/api/books/${book.id}`);
      expect(res.status).toBe(404);
      expect((await Book.findById(book.id)).status).toBe("active");
      const publicList = await request(app).get("/api/books?q=Del4");
      expect(publicList.body.data.map((b) => b.title)).toContain("Del4 Protected");
    });

    it("lets the owner archive, repeating it is safe, and it leaves public browse", async () => {
      const book = await approvedBook(bravo, "Del4 Owner");
      const first = await bravo.agent.delete(`/api/books/${book.id}`);
      expect(first.status).toBe(200);
      expect(first.body.data).toEqual({ id: book.id, status: "archived" });
      expect((await Book.findById(book.id)).status).toBe("archived");
      expect((await bravo.agent.delete(`/api/books/${book.id}`)).status).toBe(200);
      const publicList = await request(app).get("/api/books?q=Del4");
      expect(publicList.body.data.map((b) => b.title)).not.toContain("Del4 Owner");
    });

    it("refuses to archive a sold listing", async () => {
      const book = await createBook(bravo.agent, { title: "Del4 Sold" });
      await setState(book.id, { status: "sold" });
      const res = await bravo.agent.delete(`/api/books/${book.id}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("BOOK_LOCKED");
      expect((await Book.findById(book.id)).status).toBe("sold");
    });

    it("lets an admin archive any listing", async () => {
      const book = await createBook(bravo.agent, { title: "Del4 Admin" });
      expect((await delta.agent.delete(`/api/books/${book.id}`)).status).toBe(200);
      expect((await Book.findById(book.id)).status).toBe("archived");
    });
  });

  it("stores markup-like text as plain text and returns it unchanged", async () => {
    const title = "<script>alert(1)</script>";
    const book = await createBook(bravo.agent, { title });
    const res = await bravo.agent.get(`/api/books/${book.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(title);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
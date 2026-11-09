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
  if (role) await User.updateOne({ email }, { $set: { role } });
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  const user = await User.findOne({ email });
  return { agent, id: String(user._id) };
}

let userCounter = 0;
const fresh = (label, role) => loginAs(`note13.${label}.${++userCounter}@example.test`, role);

let bookCounter = 0;
async function newListing(seller) {
  const res = await seller.agent.post("/api/books").send({
    title: `Note13 Book ${++bookCounter}`,
    author: "A. Author",
    category: "Physics",
    audience: "school",
    condition: "good",
    priceMinor: 25000,
  });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

const reject = (admin, id, reason) =>
  admin.agent.patch(`/api/admin/books/${id}`).send({ moderationState: "rejected", reason });
const approve = (admin, id) => admin.agent.patch(`/api/admin/books/${id}`).send({ moderationState: "approved" });

describe("rejection reasons", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Book.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("shows the reason to the seller and to nobody else", async () => {
    const seller = await fresh("seller");
    const admin = await fresh("admin", "admin");
    const other = await fresh("other");
    const id = await newListing(seller);

    expect((await reject(admin, id, "  Cover photo is blurry  ")).status).toBe(200);

    const detail = await seller.agent.get(`/api/books/${id}`);
    expect(detail.body.data).toMatchObject({ moderationState: "rejected", moderationNote: "Cover photo is blurry" });
    const mine = await seller.agent.get("/api/books/mine?limit=50");
    expect(mine.body.data.find((b) => b.id === id).moderationNote).toBe("Cover photo is blurry");
    expect((await Book.findById(id)).moderationNote).toBe("Cover photo is blurry");

    // A rejected listing is not public at all, so no one else can reach it or its reason.
    expect((await other.agent.get(`/api/books/${id}`)).status).toBe(404);
    expect((await request(app).get(`/api/books/${id}`)).status).toBe(404);
  });

  it("clears the reason when the listing is approved or the seller resubmits it", async () => {
    const seller = await fresh("clear-seller");
    const admin = await fresh("clear-admin", "admin");
    const id = await newListing(seller);

    await reject(admin, id, "Description is missing key details").expect(200);
    await approve(admin, id).expect(200);
    const approved = await seller.agent.get(`/api/books/${id}`);
    expect(approved.body.data.moderationState).toBe("approved");
    expect(approved.body.data.moderationNote).toBeUndefined();

    await reject(admin, id, "Please add the edition").expect(200);
    const edited = await seller.agent.patch(`/api/books/${id}`).send({ edition: "2024 edition" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.moderationState).toBe("pending");
    expect(edited.body.data.moderationNote).toBeUndefined();
    expect((await Book.findById(id)).moderationNote).toBe("");
  });

  it("never puts a reason in the public listing format", async () => {
    const seller = await fresh("public-seller");
    const admin = await fresh("public-admin", "admin");
    const id = await newListing(seller);
    await approve(admin, id).expect(200);

    // Even if a stale note were left in the database, public views must not show it.
    await Book.updateOne({ _id: id }, { $set: { moderationNote: "stale reason" } });
    const detail = await request(app).get(`/api/books/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).not.toHaveProperty("moderationNote");
    const list = await request(app).get("/api/books?limit=50");
    expect(list.body.data.every((book) => !("moderationNote" in book))).toBe(true);
  });
});
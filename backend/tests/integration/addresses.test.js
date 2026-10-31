import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Address, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) {
    await Address.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
    await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
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
const freshUser = (label) => loginAs(`addr7.${label}.${++userCounter}@example.test`);

const validAddress = (over = {}) => ({
  recipientName: "Alfa Buyer",
  phone: "+91 98765 43210",
  line1: "12 Test Street",
  line2: "Near Test Park",
  city: "Testville",
  state: "Test State",
  postalCode: "123456",
  country: "IN",
  ...over,
});

const create = (user, over) => user.agent.post("/api/addresses").send(validAddress(over));

describe("addresses API", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Address.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("requires login for every address route", async () => {
    const id = String(new mongoose.Types.ObjectId());
    expect((await request(app).get("/api/addresses")).status).toBe(401);
    expect((await request(app).post("/api/addresses").send(validAddress())).status).toBe(401);
    expect((await request(app).patch(`/api/addresses/${id}`).send({ city: "X City" })).status).toBe(401);
    expect((await request(app).delete(`/api/addresses/${id}`)).status).toBe(401);
  });

  it("creates an address for the session user, makes the first one default and normalizes the country", async () => {
    const user = await freshUser("create");
    const res = await create(user, {
      country: "in",
      userId: String(new mongoose.Types.ObjectId()),
      isDefault: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      recipientName: "Alfa Buyer",
      city: "Testville",
      postalCode: "123456",
      country: "IN",
      isDefault: true,
    });
    expect(res.body.data).not.toHaveProperty("userId");
    const stored = await Address.findById(res.body.data.id);
    expect(String(stored.userId)).toBe(user.id);
  });

  it("rejects invalid addresses with field-level errors", async () => {
    const user = await freshUser("invalid");
    const bad = [
      {},
      { recipientName: "A" },
      { phone: "abc" },
      { phone: "123" },
      { postalCode: "12" },
      { postalCode: "012345" }, // Indian PINs cannot start with 0
      { postalCode: "12345" }, // and must have 6 digits
      { line1: "" },
      { city: "x".repeat(61) },
      { country: "India" },
      { isDefault: "yes" },
    ];
    for (const patch of bad) {
      const body = Object.keys(patch).length === 0 ? {} : validAddress(patch);
      const res = await user.agent.post("/api/addresses").send(body);
      expect(res.status, JSON.stringify(patch)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const pin = await create(user, { postalCode: "012345" });
    expect(pin.body.error.details.map((d) => d.field)).toContain("postalCode");

    // Other countries are not forced into the Indian format.
    const uk = await create(user, { country: "GB", postalCode: "SW1A 1AA", phone: "+44 20 7946 0958" });
    expect(uk.status).toBe(201);
  });

  it("keeps exactly one default address", async () => {
    const user = await freshUser("default");
    const first = (await create(user)).body.data;
    expect(first.isDefault).toBe(true);
    const second = (await create(user, { line1: "Second Street", isDefault: true })).body.data;
    expect(second.isDefault).toBe(true);
    const third = (await create(user, { line1: "Third Street" })).body.data;
    expect(third.isDefault).toBe(false);

    const list = await user.agent.get("/api/addresses");
    const defaults = list.body.data.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.id);
    expect(await Address.countDocuments({ userId: user.id, isDefault: true })).toBe(1);
  });

  it("lists only the caller's own addresses", async () => {
    const a = await freshUser("list-a");
    const b = await freshUser("list-b");
    await create(a, { line1: "A Street" });
    await create(b, { line1: "B Street" });
    const listA = await a.agent.get("/api/addresses");
    const listB = await b.agent.get("/api/addresses");
    expect(listA.body.data.map((x) => x.line1)).toEqual(["A Street"]);
    expect(listB.body.data.map((x) => x.line1)).toEqual(["B Street"]);
  });

  it("edits own addresses with a field whitelist, and blocks other users (IDOR)", async () => {
    const a = await freshUser("patch-a");
    const b = await freshUser("patch-b");
    const mine = (await create(a)).body.data;

    const ok = await a.agent
      .patch(`/api/addresses/${mine.id}`)
      .send({ city: "New City", userId: b.id });
    expect(ok.status).toBe(200);
    expect(ok.body.data.city).toBe("New City");
    expect(String((await Address.findById(mine.id)).userId)).toBe(a.id);

    const foreign = await b.agent.patch(`/api/addresses/${mine.id}`).send({ city: "Hacked" });
    expect(foreign.status).toBe(404);
    expect((await Address.findById(mine.id)).city).toBe("New City");

    expect((await a.agent.patch(`/api/addresses/${mine.id}`).send({})).status).toBe(400);
    expect((await a.agent.patch(`/api/addresses/${mine.id}`).send({ isDefault: false })).status).toBe(400);
    expect((await a.agent.patch(`/api/addresses/${mine.id}`).send({ phone: "abc" })).status).toBe(400);
    expect((await a.agent.patch(`/api/addresses/${mine.id}`).send({ postalCode: "12345" })).status).toBe(400);
    expect((await a.agent.patch("/api/addresses/not-an-id").send({ city: "X City" })).status).toBe(400);

    const second = (await create(a, { line1: "Second Street" })).body.data;
    const promoted = await a.agent.patch(`/api/addresses/${second.id}`).send({ isDefault: true });
    expect(promoted.status).toBe(200);
    expect(await Address.countDocuments({ userId: a.id, isDefault: true })).toBe(1);
    expect((await Address.findById(second.id)).isDefault).toBe(true);
  });

  it("deletes own addresses, promotes another default, and blocks other users (IDOR)", async () => {
    const a = await freshUser("delete-a");
    const b = await freshUser("delete-b");
    const first = (await create(a, { line1: "First Street" })).body.data; // default
    const second = (await create(a, { line1: "Second Street" })).body.data;

    const foreign = await b.agent.delete(`/api/addresses/${first.id}`);
    expect(foreign.status).toBe(404);
    expect(await Address.findById(first.id)).not.toBeNull();

    const removed = await a.agent.delete(`/api/addresses/${first.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ id: first.id, deleted: true });
    expect(await Address.findById(first.id)).toBeNull();
    expect((await Address.findById(second.id)).isDefault).toBe(true);

    expect((await a.agent.delete(`/api/addresses/${first.id}`)).status).toBe(404);
    expect((await a.agent.delete("/api/addresses/not-an-id")).status).toBe(400);
  });

  it("limits how many addresses one user can save", async () => {
    const user = await freshUser("limit");
    await Address.insertMany(
      Array.from({ length: 10 }, (_, i) => ({ ...validAddress({ line1: `Seed ${i}` }), userId: user.id, isDefault: i === 0 }))
    );
    const res = await create(user);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ADDRESS_LIMIT");
    expect(await Address.countDocuments({ userId: user.id })).toBe(10);
  });
});
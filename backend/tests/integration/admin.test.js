import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book, Cart, Wishlist, Address, Order, Session, AuditEvent } from "../../models/index.js";

const runFile = promisify(execFile);
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
  await AuditEvent.deleteMany({}); // safe: lib/db.js refuses to run tests on any database not ending in _test
}

async function loginAs(email) {
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: PASSWORD })
    .expect(201);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  const user = await User.findOne({ email });
  return { agent, id: String(user._id), email };
}

let userCounter = 0;
const freshUser = (label) => loginAs(`adm9.${label}.${++userCounter}@example.test`);

// The session reads the role from the database on every request, so promoting here takes effect at once.
async function freshAdmin(label) {
  const user = await freshUser(label);
  await User.updateOne({ _id: user.id }, { $set: { role: "admin" } });
  return user;
}

let bookCounter = 0;
const makeBook = (sellerId, patch = {}) =>
  Book.create({
    sellerId,
    title: `Adm9 Book ${++bookCounter}`,
    author: "A. Author",
    category: "Physics",
    audience: "school",
    condition: "good",
    priceMinor: 10000,
    moderationState: "pending",
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

const placeOrder = (buyer) => buyer.agent.post("/api/orders").send({ addressId: buyer.addressId });

function call(client, method, path, body) {
  let req = client[method](path);
  if (body) req = req.send(body);
  return req;
}

const auditFor = (targetId) => AuditEvent.find({ targetId }).sort({ createdAt: 1 }).lean();

async function makeAdminCli(...args) {
  try {
    const { stdout } = await runFile(process.execPath, ["scripts/make-admin.js", ...args], {
      cwd: process.cwd(),
      env: process.env, // NODE_ENV=test is inherited, so the script uses the test database
      timeout: 100000,
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("admin API", () => {
  let admin;
  let seller;
  let plain;

  beforeAll(async () => {
    await connectDb();
    await Promise.all([
      User.init(), Book.init(), Cart.init(), Wishlist.init(), Address.init(), Order.init(), Session.init(), AuditEvent.init(),
    ]);
    await cleanup();
    admin = await freshAdmin("main");
    seller = await freshUser("seller");
    plain = await freshUser("plain");
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("answers 401 to anonymous callers and 403 to normal users on every admin route", async () => {
    const id = String(new mongoose.Types.ObjectId());
    const routes = [
      ["get", "/api/admin/books"],
      ["patch", `/api/admin/books/${id}`, { moderationState: "approved" }],
      ["get", "/api/admin/orders"],
      ["get", "/api/admin/users"],
      ["patch", `/api/admin/users/${id}`, { status: "disabled" }],
      ["get", "/api/admin/audit"],
    ];
    for (const [method, path, body] of routes) {
      const anon = await call(request(app), method, path, body);
      expect(anon.status, `${method} ${path} anonymous`).toBe(401);
      const normal = await call(plain.agent, method, path, body);
      expect(normal.status, `${method} ${path} normal user`).toBe(403);
      expect(normal.body.error.code).toBe("FORBIDDEN");
    }

    // A normal user cannot approve their own listing, even by adding "role" to the request.
    const own = await makeBook(plain.id, { title: "Adm9 Self Approve" });
    const res = await plain.agent
      .patch(`/api/admin/books/${own._id}`)
      .send({ moderationState: "approved", role: "admin" });
    expect(res.status).toBe(403);
    expect((await Book.findById(own._id)).moderationState).toBe("pending");
  });

  it("takes admin access away the moment the role is removed", async () => {
    const temp = await freshAdmin("temp");
    expect((await temp.agent.get("/api/admin/audit")).status).toBe(200);
    await User.updateOne({ _id: temp.id }, { $set: { role: "user" } });
    expect((await temp.agent.get("/api/admin/audit")).status).toBe(403);
  });

  it("lists the moderation queue oldest first, filtered, with seller names and no emails", async () => {
    await makeBook(seller.id, { title: "Adm9 Queue A" });
    await makeBook(seller.id, { title: "Adm9 Queue B" });
    await makeBook(seller.id, { title: "Adm9 Queue Approved", moderationState: "approved" });
    await makeBook(seller.id, { title: "Adm9 Queue Sold", moderationState: "approved", status: "sold" });

    const pending = await admin.agent.get("/api/admin/books?moderationState=pending&limit=50");
    expect(pending.status).toBe(200);
    const queue = pending.body.data.filter((b) => b.title.startsWith("Adm9 Queue"));
    expect(queue.map((b) => b.title)).toEqual(["Adm9 Queue A", "Adm9 Queue B"]);
    expect(queue[0]).toMatchObject({ moderationState: "pending", status: "active", seller: { id: seller.id, name: "Test User" } });
    expect(JSON.stringify(pending.body)).not.toMatch(/"email"|passwordHash/);

    const sold = await admin.agent.get("/api/admin/books?status=sold&limit=50");
    expect(sold.body.data.length).toBeGreaterThan(0);
    expect(sold.body.data.every((b) => b.status === "sold")).toBe(true);
    expect(pending.body.meta).toMatchObject({ page: 1, limit: 50 });

    for (const qs of ["moderationState=bogus", "status=nope", "page=0", "limit=1000", "moderationState=a&moderationState=b"]) {
      const res = await admin.agent.get(`/api/admin/books?${qs}`);
      expect(res.status, qs).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("approves a listing, publishes it, records who did it, and ignores a repeat", async () => {
    const book = await makeBook(seller.id, { title: "Adm9 Approve Me" });
    const search = (title) => request(app).get(`/api/books?q=${encodeURIComponent(title)}`);
    expect((await search("Adm9 Approve Me")).body.data).toEqual([]);

    const res = await admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: String(book._id), moderationState: "approved", seller: { id: seller.id } });
    expect((await search("Adm9 Approve Me")).body.data.map((b) => b.title)).toEqual(["Adm9 Approve Me"]);

    const events = await auditFor(book._id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "book.moderate", source: "api", targetType: "book", details: { from: "pending", to: "approved" } });
    expect(String(events[0].actorId)).toBe(admin.id);

    expect((await admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "approved" })).status).toBe(200);
    expect(await auditFor(book._id)).toHaveLength(1);
  });

  it("rejects a listing only with a reason, takes it off the public site and allows reconsidering", async () => {
    const book = await makeBook(seller.id, { title: "Adm9 Take Down", moderationState: "approved" });
    const search = () => request(app).get(`/api/books?q=${encodeURIComponent("Adm9 Take Down")}`);
    expect((await search()).body.data).toHaveLength(1);

    const noReason = await admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "rejected" });
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.details.map((d) => d.field)).toContain("reason");
    expect((await admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "rejected", reason: "no" })).status).toBe(400);
    expect((await Book.findById(book._id)).moderationState).toBe("approved");

    const res = await admin.agent
      .patch(`/api/admin/books/${book._id}`)
      .send({ moderationState: "rejected", reason: "  Contains contact details  " });
    expect(res.status).toBe(200);
    expect(res.body.data.moderationState).toBe("rejected");
    expect((await search()).body.data).toEqual([]);

    const owner = await seller.agent.get(`/api/books/${book._id}`);
    expect(owner.body.data.moderationState).toBe("rejected");

    const back = await admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "approved" });
    expect(back.status).toBe(200);
    expect((await search()).body.data).toHaveLength(1);

    const events = await auditFor(book._id);
    expect(events.map((e) => e.details.to)).toEqual(["rejected", "approved"]);
    expect(events[0].details.reason).toBe("Contains contact details");
  });

  it("rejects invalid moderation requests and ignores extra fields", async () => {
    const book = await makeBook(seller.id, { title: "Adm9 Validation" });
    const bad = [{}, { moderationState: "pending" }, { moderationState: "hacked" }, { moderationState: { $ne: null } }, { moderationState: ["approved"] }];
    for (const body of bad) {
      const res = await admin.agent.patch(`/api/admin/books/${book._id}`).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await auditFor(book._id)).toHaveLength(0);

    const res = await admin.agent
      .patch(`/api/admin/books/${book._id}`)
      .send({ moderationState: "approved", status: "sold", sellerId: plain.id, priceMinor: 1 });
    expect(res.status).toBe(200);
    const stored = await Book.findById(book._id);
    expect(stored).toMatchObject({ status: "active", priceMinor: 10000, moderationState: "approved" });
    expect(String(stored.sellerId)).toBe(seller.id);

    expect((await admin.agent.patch("/api/admin/books/not-an-id").send({ moderationState: "approved" })).status).toBe(400);
    const unknown = await admin.agent
      .patch(`/api/admin/books/${new mongoose.Types.ObjectId()}`)
      .send({ moderationState: "approved" });
    expect(unknown.status).toBe(404);
  });

  it("handles simultaneous approvals safely: one change, one audit entry", { timeout: 120000 }, async () => {
    const book = await makeBook(seller.id, { title: "Adm9 Race" });
    const results = await Promise.all(
      Array.from({ length: 3 }, () => admin.agent.patch(`/api/admin/books/${book._id}`).send({ moderationState: "approved" }))
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect((await Book.findById(book._id)).moderationState).toBe("approved");
    expect(await auditFor(book._id)).toHaveLength(1);
  });

  it("shows admins orders with minimal data and filters them", async () => {
    const book = await makeBook(seller.id, { moderationState: "approved" });
    const buyer = await readyBuyer("orders", [book]);
    const order = (await placeOrder(buyer)).body.data;

    const res = await admin.agent.get("/api/admin/orders?limit=50");
    expect(res.status).toBe(200);
    const found = res.body.data.find((o) => o.id === order.id);
    expect(found).toMatchObject({
      orderNumber: order.orderNumber,
      status: "placed",
      paymentStatus: "unpaid",
      buyer: { id: buyer.id, name: "Test User" },
      itemCount: 1,
      totalMinor: order.totalMinor,
    });
    expect(found.items[0].title).toBe(book.title);
    expect(JSON.stringify(found)).not.toMatch(/"(phone|email|line1|city|postalCode|recipientName|shippingAddress|passwordHash)"/);

    const placed = await admin.agent.get("/api/admin/orders?status=placed&limit=50");
    expect(placed.body.data.some((o) => o.id === order.id)).toBe(true);
    const cancelled = await admin.agent.get("/api/admin/orders?status=cancelled&limit=50");
    expect(cancelled.body.data.some((o) => o.id === order.id)).toBe(false);
    const paid = await admin.agent.get("/api/admin/orders?paymentStatus=paid&limit=50");
    expect(paid.body.data.some((o) => o.id === order.id)).toBe(false);

    for (const qs of ["status=bogus", "paymentStatus=nope", "limit=51", "page=abc"]) {
      expect((await admin.agent.get(`/api/admin/orders?${qs}`)).status, qs).toBe(400);
    }
  });

  it("lists users with filters and never exposes password data", async () => {
    const byEmail = await admin.agent.get(`/api/admin/users?email=${encodeURIComponent(seller.email.toUpperCase())}`);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0]).toMatchObject({ id: seller.id, email: seller.email, role: "user", status: "active" });
    expect(byEmail.body.data[0].createdAt).toBeTruthy();
    expect(JSON.stringify(byEmail.body)).not.toMatch(/passwordHash|argon2/);

    const admins = await admin.agent.get("/api/admin/users?role=admin&limit=50");
    expect(admins.body.data.length).toBeGreaterThan(0);
    expect(admins.body.data.every((u) => u.role === "admin")).toBe(true);
    expect(admins.body.data.map((u) => u.id)).toContain(admin.id);

    for (const qs of ["role=owner", "status=banned", "limit=1000", "email=a&email=b"]) {
      expect((await admin.agent.get(`/api/admin/users?${qs}`)).status, qs).toBe(400);
    }
  });

  it("disables a user (ending their sessions), re-enables them, and audits both", async () => {
    const victim = await freshUser("victim");
    expect((await victim.agent.get("/api/auth/me")).status).toBe(200);

    const off = await admin.agent.patch(`/api/admin/users/${victim.id}`).send({ status: "disabled" });
    expect(off.status).toBe(200);
    expect(off.body.data).toMatchObject({ id: victim.id, status: "disabled", role: "user" });
    expect((await victim.agent.get("/api/auth/me")).status).toBe(401);
    expect(await Session.countDocuments({ userId: victim.id })).toBe(0);
    const login = await request(app).post("/api/auth/login").send({ email: victim.email, password: PASSWORD });
    expect(login.status).toBe(401);

    expect((await admin.agent.patch(`/api/admin/users/${victim.id}`).send({ status: "disabled" })).status).toBe(200);
    expect(await auditFor(victim.id)).toHaveLength(1);

    // Extra fields such as "role" are ignored.
    const on = await admin.agent.patch(`/api/admin/users/${victim.id}`).send({ status: "active", role: "admin" });
    expect(on.status).toBe(200);
    expect(on.body.data).toMatchObject({ status: "active", role: "user" });
    expect((await User.findById(victim.id)).role).toBe("user");
    expect((await request(app).post("/api/auth/login").send({ email: victim.email, password: PASSWORD })).status).toBe(200);

    const events = await auditFor(victim.id);
    expect(events.map((e) => e.details.to)).toEqual(["disabled", "active"]);
    expect(events.every((e) => e.action === "user.status" && String(e.actorId) === admin.id)).toBe(true);
  });

  it("protects admins and the caller, and rejects bad user updates", async () => {
    const self = await admin.agent.patch(`/api/admin/users/${admin.id}`).send({ status: "disabled" });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("CANNOT_MODIFY_SELF");

    const other = await freshAdmin("other-admin");
    const protectedRes = await admin.agent.patch(`/api/admin/users/${other.id}`).send({ status: "disabled" });
    expect(protectedRes.status).toBe(409);
    expect(protectedRes.body.error.code).toBe("ADMIN_PROTECTED");
    expect((await User.findById(other.id)).status).toBe("active");

    expect((await admin.agent.patch(`/api/admin/users/${new mongoose.Types.ObjectId()}`).send({ status: "disabled" })).status).toBe(404);
    expect((await admin.agent.patch("/api/admin/users/not-an-id").send({ status: "disabled" })).status).toBe(400);
    for (const body of [{}, { status: "banned" }, { status: { $ne: null } }, { role: "admin" }]) {
      const res = await admin.agent.patch(`/api/admin/users/${plain.id}`).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await User.findById(plain.id)).role).toBe("user");
  });

  it("serves the audit log newest first, paginated, without sensitive data", async () => {
    const res = await admin.agent.get("/api/admin/audit?limit=50");
    expect(res.status).toBe(200);
    const events = res.body.data;
    expect(events.length).toBeGreaterThan(2);
    for (let i = 0; i < events.length - 1; i++) {
      expect(new Date(events[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(events[i + 1].createdAt).getTime());
    }
    expect(events[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), action: expect.any(String), source: "api", targetType: expect.any(String), targetId: expect.any(String) })
    );
    const actions = events.map((e) => e.action);
    expect(actions).toContain("book.moderate");
    expect(actions).toContain("user.status");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|"email"/);

    const first = await admin.agent.get("/api/admin/audit?limit=1");
    expect(first.body.data).toHaveLength(1);
    expect(first.body.meta.total).toBe(res.body.meta.total);
    expect((await admin.agent.get("/api/admin/audit?limit=51")).status).toBe(400);
  });

  it("creates an admin from the command line, on the test database, and records it", { timeout: 300000 }, async () => {
    const usage = await makeAdminCli();
    expect(usage.code).toBe(1);

    const missing = await makeAdminCli("nobody.here@example.test");
    expect(missing.code).toBe(1);
    expect(missing.stdout).toMatch(/_test/); // proof that it ran against the test database

    const user = await freshUser("cli-grant");
    const granted = await makeAdminCli(user.email);
    expect(granted.code).toBe(0);
    expect((await User.findById(user.id)).role).toBe("admin");
    expect((await user.agent.get("/api/admin/audit")).status).toBe(200); // the existing session now has admin access

    const events = await auditFor(user.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "admin.grant", source: "cli" });
    expect(events[0].actorId).toBeNull();

    expect((await makeAdminCli(user.email)).code).toBe(0); // running it again changes nothing
    expect(await auditFor(user.id)).toHaveLength(1);
  });

  it("removes an admin from the command line but never the last one", { timeout: 300000 }, async () => {
    const extra = await freshUser("cli-revoke");
    expect((await makeAdminCli(extra.email)).code).toBe(0);

    const revoked = await makeAdminCli(extra.email, "--revoke");
    expect(revoked.code).toBe(0);
    expect((await User.findById(extra.id)).role).toBe("user");
    expect((await extra.agent.get("/api/admin/audit")).status).toBe(403);
    expect((await auditFor(extra.id)).map((e) => e.action)).toEqual(["admin.grant", "admin.revoke"]);

    // Earlier tests left other admins behind, so demote them directly in the database
    // until only the main test admin remains. Removing that last one must then be refused.
    await User.updateMany({ role: "admin", _id: mongoose.trusted({ $ne: admin.id }) }, { $set: { role: "user" } });
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
    const refused = await makeAdminCli(admin.email, "--revoke");
    expect(refused.code).toBe(1);
    expect((await User.findById(admin.id)).role).toBe("admin");
  });
});
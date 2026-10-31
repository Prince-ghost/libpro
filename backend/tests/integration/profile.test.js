import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";
const NEW_PASSWORD = "BrandNew-Pass-456";
const PW = "/api/profile/password";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
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
  return { agent, id: String(user._id), email };
}

let userCounter = 0;
const freshUser = (label) => loginAs(`prof8.${label}.${++userCounter}@example.test`);

describe("profile API", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("requires login for every profile route", async () => {
    expect((await request(app).get("/api/profile")).status).toBe(401);
    expect((await request(app).patch("/api/profile").send({ name: "New Name" })).status).toBe(401);
    expect((await request(app).post(PW).send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).status).toBe(401);
  });

  it("returns the caller's own profile without secrets", async () => {
    const user = await freshUser("get");
    const res = await user.agent.get("/api/profile");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, name: "Test User", email: user.email, role: "user" });
    expect(res.body.data.createdAt).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
  });

  it("updates the name and nothing else", async () => {
    const user = await freshUser("update");
    const res = await user.agent
      .patch("/api/profile")
      .send({ name: "  New Name  ", email: "hacker@example.test", role: "admin", status: "disabled" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "New Name", email: user.email, role: "user" });
    const stored = await User.findById(user.id);
    expect(stored).toMatchObject({ name: "New Name", email: user.email, role: "user", status: "active" });
  });

  it("rejects invalid profile updates", async () => {
    const user = await freshUser("invalid");
    const bad = [{}, { name: "" }, { name: "A" }, { name: "x".repeat(81) }, { name: 123 }, { name: { $ne: "" } }];
    for (const body of bad) {
      const res = await user.agent.patch("/api/profile").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await User.findById(user.id)).name).toBe("Test User");
  });

  it("refuses a wrong or unsuitable password change and changes nothing", async () => {
    const user = await freshUser("pw-bad");
    const wrong = await user.agent.post(PW).send({ currentPassword: "WrongPassword-999", newPassword: NEW_PASSWORD });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe("INVALID_PASSWORD");

    const bad = [
      { currentPassword: PASSWORD, newPassword: "short" },
      { currentPassword: PASSWORD, newPassword: PASSWORD },
      { currentPassword: { $ne: "" }, newPassword: NEW_PASSWORD },
      {},
    ];
    for (const body of bad) {
      const res = await user.agent.post(PW).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const stillOld = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(stillOld.status).toBe(200);
  });

  it("changes the password, ends other sessions and keeps the current one", async () => {
    const user = await freshUser("pw-ok");
    const other = request.agent(app);
    await other.post("/api/auth/login").send({ email: user.email, password: PASSWORD }).expect(200);
    expect((await other.get("/api/auth/me")).status).toBe(200);

    const res = await user.agent.post(PW).send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ passwordChanged: true });

    expect((await user.agent.get("/api/auth/me")).status).toBe(200); // this session survives
    expect((await other.get("/api/auth/me")).status).toBe(401); // the other one is gone
    expect((await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: user.email, password: NEW_PASSWORD })).status).toBe(200);

    const stored = await User.findOne({ email: user.email }).select("+passwordHash");
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
  });
});
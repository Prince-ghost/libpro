import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import app from "../../app.js";
import { env } from "../../lib/env.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { errorHandler } from "../../lib/http.js";
import { requireAuth, requireRole, COOKIE_NAME } from "../../lib/auth.js";
import { createLimiter } from "../../lib/rate-limit.js";
import { User, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";
const REGISTER = "/api/auth/register";
const LOGIN = "/api/auth/login";
const LOGOUT = "/api/auth/logout";
const ME = "/api/auth/me";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
  await User.deleteMany({ email: TEST_EMAIL });
}

async function makeUser(email) {
  const res = await request(app).post(REGISTER).send({ name: "Test User", email, password: PASSWORD });
  expect(res.status).toBe(201);
  return res.body.data.user;
}

const sessionCookie = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE_NAME}=`));
const cookieValue = (res) => sessionCookie(res)?.split(";")[0].split("=")[1];

describe("auth API", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("register creates a user, normalizes the email and never returns secrets", async () => {
    const res = await request(app)
      .post(REGISTER)
      .send({ name: "  Alfa Buyer ", email: "  Buyer.Alfa@Example.Test ", password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: "Alfa Buyer",
      email: "buyer.alfa@example.test",
      role: "user",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2|CorrectHorse/);
    const stored = await User.findOne({ email: "buyer.alfa@example.test" }).select("+passwordHash");
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("register ignores role and status sent by the client", async () => {
    const res = await request(app)
      .post(REGISTER)
      .send({ name: "Mallory Test", email: "mallory@example.test", password: PASSWORD, role: "admin", status: "disabled" });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("user");
    const stored = await User.findOne({ email: "mallory@example.test" });
    expect(stored.role).toBe("user");
    expect(stored.status).toBe("active");
  });

  it("register rejects a duplicate email, case-insensitively", async () => {
    await makeUser("dup.user@example.test");
    const res = await request(app)
      .post(REGISTER)
      .send({ name: "Dup Two", email: "DUP.USER@example.test", password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("register returns field-level validation errors", async () => {
    const res = await request(app).post(REGISTER).send({ name: "", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(["email", "name", "password"]);
  });

  it("malformed JSON is a controlled 400", async () => {
    const res = await request(app).post(REGISTER).set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("login gives the same 401 for an unknown email and a wrong password", async () => {
    await makeUser("login.user@example.test");
    const wrong = await request(app).post(LOGIN).send({ email: "login.user@example.test", password: "WrongPassword-999" });
    const unknown = await request(app).post(LOGIN).send({ email: "nobody.here@example.test", password: "WrongPassword-999" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(sessionCookie(wrong)).toBeUndefined();
  });

  it("login sets an HttpOnly SameSite cookie, keeps the token out of the body and stores only a hash", async () => {
    await makeUser("cookie.user@example.test");
    const res = await request(app).post(LOGIN).send({ email: "cookie.user@example.test", password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    const token = cookieValue(res);
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(await Session.findOne({ tokenHash: token })).toBeNull(); // the raw token is not what is stored
    expect(await Session.countDocuments({ userId: res.body.data.user.id })).toBe(1);
  });

  it("login rejects MongoDB operator objects in the body", async () => {
    const res = await request(app).post(LOGIN).send({ email: { $ne: "" }, password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("/me answers 401 without a session, with a garbage cookie, and with a JSON-style cookie", async () => {
    expect((await request(app).get(ME)).status).toBe(401);
    expect((await request(app).get(ME).set("Cookie", `${COOKIE_NAME}=garbage`)).status).toBe(401);
    expect((await request(app).get(ME).set("Cookie", `${COOKIE_NAME}=j:{"a":1}`)).status).toBe(401);
  });

  it("/me returns only the safe user for a valid session", async () => {
    await makeUser("me.user@example.test");
    const agent = request.agent(app);
    await agent.post(LOGIN).send({ email: "me.user@example.test", password: PASSWORD }).expect(200);
    const res = await agent.get(ME);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("me.user@example.test");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it("logout invalidates the session on the server and repeating it is safe", async () => {
    await makeUser("logout.user@example.test");
    const agent = request.agent(app);
    const login = await agent.post(LOGIN).send({ email: "logout.user@example.test", password: PASSWORD });
    const oldCookie = `${COOKIE_NAME}=${cookieValue(login)}`;

    const out = await agent.post(LOGOUT);
    expect(out.status).toBe(200);
    expect(sessionCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect((await agent.get(ME)).status).toBe(401);
    // Replaying the old cookie by hand must fail too: the session is gone from the database.
    expect((await request(app).get(ME).set("Cookie", oldCookie)).status).toBe(401);
    expect((await request(app).post(LOGOUT)).status).toBe(200);
  });

  it("a disabled user cannot log in and an existing session stops working", async () => {
    await makeUser("disabled.user@example.test");
    const agent = request.agent(app);
    await agent.post(LOGIN).send({ email: "disabled.user@example.test", password: PASSWORD }).expect(200);
    expect((await agent.get(ME)).status).toBe(200);

    await User.updateOne({ email: "disabled.user@example.test" }, { status: "disabled" });
    expect((await agent.get(ME)).status).toBe(401);
    const again = await request(app).post(LOGIN).send({ email: "disabled.user@example.test", password: PASSWORD });
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("blocks state-changing requests from a foreign Origin", async () => {
    const body = { email: "x@example.test", password: "whatever-123" };
    const bad = await request(app).post(LOGIN).set("Origin", "http://evil.example").send(body);
    expect(bad.status).toBe(403);
    expect(bad.body.error.code).toBe("CSRF_BLOCKED");
    const ok = await request(app).post(LOGIN).set("Origin", env.CLIENT_ORIGIN).send(body);
    expect(ok.status).toBe(401); // got past the origin check; the credentials are simply wrong
  });

  it("requireRole: 401 when logged out, 403 for a normal user, 200 once the database says admin", async () => {
    const mini = express();
    mini.use(cookieParser());
    mini.get("/admin-only", requireAuth, requireRole("admin"), (req, res) => res.json({ ok: true }));
    mini.use(errorHandler);

    await makeUser("role.user@example.test");
    const login = await request(app).post(LOGIN).send({ email: "role.user@example.test", password: PASSWORD });
    const cookie = `${COOKIE_NAME}=${cookieValue(login)}`;

    expect((await request(mini).get("/admin-only")).status).toBe(401);
    expect((await request(mini).get("/admin-only").set("Cookie", cookie)).status).toBe(403);
    await User.updateOne({ email: "role.user@example.test" }, { role: "admin" });
    expect((await request(mini).get("/admin-only").set("Cookie", cookie)).status).toBe(200);
  });

  it("the rate limiter answers 429 once the limit is exceeded", async () => {
    const mini = express();
    mini.use(createLimiter({ windowMs: 60_000, max: 3 }));
    mini.post("/try", (req, res) => res.json({ ok: true }));
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await request(mini).post("/try")).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
});
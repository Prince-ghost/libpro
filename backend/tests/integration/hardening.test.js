import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import app from "../../app.js";
import { env } from "../../lib/env.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { requestId, errorHandler } from "../../lib/http.js";
import { User, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";
const COOKIE = "bookback_sid";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
  await User.deleteMany({ email: TEST_EMAIL });
}

const register = (email) =>
  request(app).post("/api/auth/register").send({ name: "Test User", email, password: PASSWORD });
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const cookieValue = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`))?.split(";")[0].split("=")[1];

describe("hardening", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("hides internal error details from clients but logs a request-linked line for us", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mini = express();
    mini.use(requestId);
    mini.get("/boom", () => {
      throw new Error("internal-detail-do-not-leak");
    });
    mini.use(errorHandler);

    const res = await request(mini).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Something went wrong." });
    expect(JSON.stringify(res.body)).not.toMatch(/internal-detail|stack|node_modules/i);

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged.requestId).toBe(res.headers["x-request-id"]);
    expect(logged).not.toHaveProperty("stack");
    spy.mockRestore();
  });

  it("sends security headers and does not advertise the framework", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeTruthy();
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("only ever grants cross-origin access to the frontend origin", async () => {
    const evil = "http://evil.example";
    // The cors package answers with the configured origin, never the caller's, so the browser refuses
    // to give the response to a page on evil.example. The header must never grant that origin.
    const plain = await request(app).get("/api/health").set("Origin", evil);
    expect(plain.headers["access-control-allow-origin"]).not.toBe(evil);
    expect(plain.headers["access-control-allow-origin"]).not.toBe("*");

    const preflight = await request(app)
      .options("/api/books")
      .set("Origin", evil)
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.headers["access-control-allow-origin"]).not.toBe(evil);
    expect(preflight.headers["access-control-allow-origin"]).not.toBe("*");

    const good = await request(app).get("/api/health").set("Origin", env.CLIENT_ORIGIN);
    expect(good.headers["access-control-allow-origin"]).toBe(env.CLIENT_ORIGIN);
    expect(good.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers unknown routes and unsupported methods with a JSON 404", async () => {
    const cases = [
      ["get", "/api/nope"],
      ["put", "/api/books"],
      ["delete", "/api/auth/login"],
      ["post", "/api/health"],
    ];
    for (const [method, path] of cases) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("refuses an oversized request body with a generic 413", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "x".repeat(20000), email: "big@example.test", password: PASSWORD });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/i);
  });

  it("issues a fresh, unguessable session token on every login", async () => {
    const email = "hard10.session@example.test";
    await register(email).expect(201);
    const first = cookieValue(await login(email, PASSWORD));
    const second = cookieValue(await login(email, PASSWORD));
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);

    for (const token of [first, second]) {
      const me = await request(app).get("/api/auth/me").set("Cookie", `${COOKIE}=${token}`);
      expect(me.status).toBe(200);
    }
  });

  it("does not lock an account after failed logins, so attackers cannot lock victims out", async () => {
    const email = "hard10.lockout@example.test";
    await register(email).expect(201);
    for (let i = 0; i < 6; i++) {
      const res = await login(email, `WrongPassword-${i}-999`);
      expect(res.status).toBe(401);
    }
    const ok = await login(email, PASSWORD);
    expect(ok.status).toBe(200);
  });
});
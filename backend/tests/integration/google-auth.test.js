import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { AppError } from "../../lib/http.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { verifyGoogleIdToken } from "../../lib/google.js";
import { User, Session } from "../../models/index.js";

// Google is never contacted in these tests: its token check is replaced by a fake.
vi.mock("../../lib/google.js", () => ({ verifyGoogleIdToken: vi.fn() }));

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";
const COOKIE = "bookback_sid";
const TOKEN = "fake-google-credential-for-tests-0001";
const GOOGLE = "/api/auth/google";

let counter = 0;
const profile = (over = {}) => {
  const n = ++counter;
  return { sub: `google-sub-${n}`, email: `google.user${n}@example.test`, name: `Gina Google ${n}`, ...over };
};
const signIn = (client, body = {}) => client.post(GOOGLE).send({ credential: TOKEN, ...body });
const sessionCookie = (res) => (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${COOKIE}=`));
const register = (email) =>
  request(app).post("/api/auth/register").send({ name: "Real Owner", email, password: PASSWORD }).expect(201);

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) await Session.deleteMany({ userId: mongoose.trusted({ $in: ids }) });
  await User.deleteMany({ email: TEST_EMAIL });
}

describe("Google sign-in API", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Session.init()]);
    await cleanup();
  });

  beforeEach(() => {
    verifyGoogleIdToken.mockReset();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("rejects malformed bodies and foreign origins before touching Google", async () => {
    const bad = [{}, { credential: 123 }, { credential: { $ne: null } }, { credential: ["a"] }, { credential: "short" }, { credential: "x".repeat(5000) }];
    for (const body of bad) {
      const res = await request(app).post(GOOGLE).send(body);
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const foreign = await request(app).post(GOOGLE).set("Origin", "http://evil.example").send({ credential: TOKEN });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe("CSRF_BLOCKED");
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it("answers 401 with no cookie when Google's check fails", async () => {
    verifyGoogleIdToken.mockRejectedValueOnce(
      new AppError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in failed. Please try again.")
    );
    const res = await signIn(request(app));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_GOOGLE_TOKEN");
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("creates an account from a Google profile and logs it in, ignoring client-supplied role", async () => {
    const p = profile({ name: "Gina Google" });
    verifyGoogleIdToken.mockResolvedValueOnce(p);
    const agent = request.agent(app);
    const res = await signIn(agent, { role: "admin", status: "disabled" });

    expect(res.status).toBe(200);
    expect(verifyGoogleIdToken).toHaveBeenCalledWith(TOKEN);
    expect(res.body.data.user).toMatchObject({ name: "Gina Google", email: p.email, role: "user" });

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const token = cookie.split(";")[0].split("=")[1];
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(JSON.stringify(res.body)).not.toMatch(/googleId|passwordHash|google-sub/);
    expect((await agent.get("/api/auth/me")).body.data.user.email).toBe(p.email);

    const stored = await User.findOne({ email: p.email }).select("+googleId +passwordHash");
    expect(stored).toMatchObject({ googleId: p.sub, role: "user", status: "active" });
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);

    // A Google-only account has no password anyone knows.
    const pw = await request(app).post("/api/auth/login").send({ email: p.email, password: PASSWORD });
    expect(pw.status).toBe(401);
  });

  it("logs a returning Google user in without duplicating or renaming the account", async () => {
    const p = profile();
    verifyGoogleIdToken.mockResolvedValueOnce(p);
    const first = await signIn(request(app));
    await User.updateOne({ email: p.email }, { $set: { name: "Renamed Locally" } });
    verifyGoogleIdToken.mockResolvedValueOnce({ ...p, name: "Different Name" });
    const second = await signIn(request(app));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.user.name).toBe("Renamed Locally");
    expect(await User.countDocuments({ email: p.email })).toBe(1);
    expect(await Session.countDocuments({ userId: first.body.data.user.id })).toBe(2);
  });

  it("takes over an existing password account safely: old password and sessions stop working", async () => {
    const email = "google.takeover@example.test";
    await register(email);
    const old = request.agent(app);
    await old.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
    expect((await old.get("/api/auth/me")).status).toBe(200);
    const before = await User.findOne({ email });

    const p = profile({ email });
    verifyGoogleIdToken.mockResolvedValueOnce(p);
    const res = await signIn(request(app));

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(String(before._id)); // same account, so orders and addresses stay
    expect((await old.get("/api/auth/me")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: PASSWORD })).status).toBe(401);
    expect(await User.countDocuments({ email })).toBe(1);
    expect((await User.findOne({ email }).select("+googleId")).googleId).toBe(p.sub);
    expect(await Session.countDocuments({ userId: before._id })).toBe(1);
  });

  it("refuses to relink an account that already belongs to a different Google account", async () => {
    const email = "google.mismatch@example.test";
    await register(email);
    await User.updateOne({ email }, { $set: { googleId: "someone-elses-sub" } });
    verifyGoogleIdToken.mockResolvedValueOnce(profile({ email }));

    const res = await signIn(request(app));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SIGNIN_FAILED");
    expect(sessionCookie(res)).toBeUndefined();
    expect((await User.findOne({ email }).select("+googleId")).googleId).toBe("someone-elses-sub");
    expect((await request(app).post("/api/auth/login").send({ email, password: PASSWORD })).status).toBe(200);
  });

  it("refuses disabled accounts, linked or not", async () => {
    const linked = profile();
    verifyGoogleIdToken.mockResolvedValueOnce(linked);
    await signIn(request(app)).expect(200);
    await User.updateOne({ email: linked.email }, { $set: { status: "disabled" } });
    verifyGoogleIdToken.mockResolvedValueOnce(linked);
    const again = await signIn(request(app));
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("SIGNIN_FAILED");
    expect(sessionCookie(again)).toBeUndefined();

    const email = "google.disabled@example.test";
    await register(email);
    await User.updateOne({ email }, { $set: { status: "disabled" } });
    verifyGoogleIdToken.mockResolvedValueOnce(profile({ email }));
    const unlinked = await signIn(request(app));
    expect(unlinked.status).toBe(401);
    expect((await User.findOne({ email }).select("+googleId")).googleId).toBeUndefined();
  });

  it("cleans hostile, blank and oversized display names", async () => {
    const cases = [
      [{ name: "<script>alert(1)</script>" }, "<script>alert(1)</script>"], // stored as plain text
      [{ name: "  \n\t  " }, null], // falls back to the part of the email before the @
      [{ name: "x".repeat(200) }, "x".repeat(80)],
      [{ name: "Ann\u0000 \u0007Lee" }, "Ann Lee"],
    ];
    for (const [patch, expected] of cases) {
      const p = profile(patch);
      verifyGoogleIdToken.mockResolvedValueOnce(p);
      const res = await signIn(request(app));
      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe(expected ?? p.email.split("@")[0]);
    }
  });

  it("creates only one account when three first sign-ins arrive at once", { timeout: 120000 }, async () => {
    const p = profile();
    verifyGoogleIdToken.mockResolvedValue(p);
    const results = await Promise.all(Array.from({ length: 3 }, () => signIn(request(app))));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await User.countDocuments({ email: p.email })).toBe(1);
  });
});
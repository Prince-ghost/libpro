import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;

describe("database foundation", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Book.init()]); // wait for indexes
    await User.deleteMany({ email: TEST_EMAIL });
  });

  afterAll(async () => {
    await User.deleteMany({ email: TEST_EMAIL });
    await disconnectDb();
  });

  it("connects to a *_test database", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name.endsWith("_test")).toBe(true);
  });

  it("reuses one connection however many times connectDb is called", async () => {
    await Promise.all([connectDb(), connectDb(), connectDb()]);
    expect(mongoose.connections.length).toBe(1);
  });

  it("GET /api/health returns 200 and leaks nothing", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb|cluster|password/i);
  });

  it("unique email index rejects duplicates, case-insensitively", async () => {
    await User.create({ name: "Dup One", email: "block2.dup@example.test", passwordHash: "not-a-real-hash" });
    await expect(
      User.create({ name: "Dup Two", email: "BLOCK2.DUP@example.test", passwordHash: "not-a-real-hash" })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("never exposes passwordHash", async () => {
    const created = await User.create({
      name: "Hidden Hash",
      email: "block2.hash@example.test",
      passwordHash: "not-a-real-hash",
    });
    expect(JSON.parse(JSON.stringify(created)).passwordHash).toBeUndefined();
    const found = await User.findById(created._id);
    expect(found.passwordHash).toBeUndefined();
  });

    it("query operators in filters are neutralised", async () => {
    await User.create({ name: "Operator Test", email: "block2.op@example.test", passwordHash: "not-a-real-hash" });
    let found = [];
    try {
      found = await User.find({ email: { $ne: "nobody@example.test" } });
    } catch (err) {
      expect(err.name).toBe("CastError"); // injection rejected outright
    }
    expect(found).toHaveLength(0); // and never returns users either way
  });

  describe("Book schema", () => {
    const base = {
      sellerId: new mongoose.Types.ObjectId(),
      title: "Physics Part 1",
      author: "H. C. Verma",
      category: "Physics",
      audience: "school",
      condition: "good",
      description: "Used, no markings.",
      priceMinor: 25000,
    };

    it("applies safe defaults", () => {
      const book = new Book(base);
      expect(book.validateSync()).toBeUndefined();
      expect(book.status).toBe("active");
      expect(book.moderationState).toBe("pending");
      expect(book.currency).toBe("INR");
    });

    it("rejects invalid data", () => {
      const bad = [
        { priceMinor: -5 },
        { priceMinor: 10.5 },
        { audience: "nope" },
        { moderationState: "approved-ish" },
        { title: "" },
      ];
      for (const patch of bad) {
        expect(new Book({ ...base, ...patch }).validateSync()).toBeDefined();
      }
    });
  });

  it("health returns 503 with a safe body when the database is disconnected", async () => {
    await disconnectDb();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DB_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb|cluster|password/i);
    await connectDb(); // restore for cleanup
  });
});
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import sharp from "sharp";
import mongoose from "mongoose";
import app from "../../app.js";
import { connectDb, disconnectDb } from "../../lib/db.js";
import { User, Book, Image, Session } from "../../models/index.js";

const TEST_EMAIL = /@example\.test$/;
const PASSWORD = "CorrectHorse-123";

async function cleanup() {
  const users = await User.find({ email: TEST_EMAIL }).select("_id");
  const ids = users.map((u) => u._id);
  if (ids.length) {
    const inIds = () => mongoose.trusted({ $in: ids });
    await Image.deleteMany({ ownerId: inIds() });
    await Book.deleteMany({ sellerId: inIds() });
    await Session.deleteMany({ userId: inIds() });
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
const fresh = (label, role) => loginAs(`img11.${label}.${++userCounter}@example.test`, role);

let bookCounter = 0;
const validBook = (over = {}) => ({
  title: `Img11 Book ${++bookCounter}`,
  author: "A. Author",
  category: "Physics",
  audience: "school",
  condition: "good",
  priceMinor: 25000,
  ...over,
});

const solid = (width, height, format) =>
  sharp({ create: { width, height, channels: 3, background: "#336699" } })[format]().toBuffer();
const jpeg = (w = 800, h = 600) => solid(w, h, "jpeg");
const png = (w = 400, h = 300) => solid(w, h, "png");
const webp = (w = 400, h = 300) => solid(w, h, "webp");
const noisy = () =>
  sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 30 } },
  })
    .jpeg()
    .toBuffer();

const upload = (client, buffer, filename = "photo.jpg", contentType = "image/jpeg") =>
  client.post("/api/images").attach("file", buffer, { filename, contentType });

async function uploadOk(user, buffer) {
  const res = await upload(user.agent, buffer ?? (await jpeg()));
  expect(res.status).toBe(201);
  return res.body.data.id;
}

const approve = (bookId) => Book.updateOne({ _id: bookId }, { $set: { moderationState: "approved" } });

describe("photo uploads", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([User.init(), Book.init(), Image.init(), Session.init()]);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await disconnectDb();
  });

  it("requires login to upload or delete", async () => {
    expect((await upload(request(app), await jpeg())).status).toBe(401);
    expect((await request(app).delete(`/api/images/${new mongoose.Types.ObjectId()}`)).status).toBe(401);
  });

  it("stores a re-encoded WebP and strips hidden metadata such as copyright and location", async () => {
    const user = await fresh("meta");
    const marked = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#336699" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "SECRET-MARKER-123" } })
      .toBuffer();
    expect(marked.includes("SECRET-MARKER-123")).toBe(true); // the test file really contains it

    const res = await upload(user.agent, marked);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: expect.stringMatching(/^[a-f0-9]{24}$/), width: 800, height: 600 });

    const stored = await Image.findById(res.body.data.id).select("+full +thumb");
    expect(stored).toMatchObject({ contentType: "image/webp" });
    expect(String(stored.ownerId)).toBe(user.id);
    expect(stored.bookId).toBeNull();
    expect(stored.expireAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.expireAt.getTime()).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);

    const full = Buffer.from(stored.full);
    expect(full.includes("SECRET-MARKER-123")).toBe(false);
    const meta = await sharp(full).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
  });

  it("shrinks large photos and makes a thumbnail", async () => {
    const user = await fresh("resize");
    const res = await upload(user.agent, await jpeg(3000, 2000));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ width: 1200, height: 800 });
    const stored = await Image.findById(res.body.data.id).select("+thumb");
    const thumb = await sharp(Buffer.from(stored.thumb)).metadata();
    expect(thumb.width).toBeLessThanOrEqual(400);
    expect(thumb.height).toBeLessThanOrEqual(400);
  });

  it("accepts PNG and WebP photos too", async () => {
    const user = await fresh("formats");
    expect((await upload(user.agent, await png(), "a.png", "image/png")).status).toBe(201);
    expect((await upload(user.agent, await webp(), "a.webp", "image/webp")).status).toBe(201);
  });

  it("refuses files that are not safe photos and stores nothing", { timeout: 180000 }, async () => {
    const user = await fresh("reject");
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script></svg>'
    );
    const gif = Buffer.from("R0lGODlhAQABAAAAACwAAAAAAQABAAA=", "base64");
    const bomb = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: "#ffffff" } })
      .png({ compressionLevel: 9 })
      .toBuffer(); // a small file that would need more than 40 million pixels

    const cases = [
      ["svg", svg, "image.svg", "image/svg+xml"],
      ["text pretending to be a photo", Buffer.from("this is not an image"), "photo.jpg", "image/jpeg"],
      ["gif", gif, "photo.gif", "image/gif"],
      ["too small", await jpeg(50, 50), "tiny.jpg", "image/jpeg"],
      ["pixel bomb", bomb, "bomb.png", "image/png"],
    ];
    for (const [label, buffer, filename, type] of cases) {
      const res = await upload(user.agent, buffer, filename, type);
      expect([400, 415], label).toContain(res.status);
      expect(["INVALID_IMAGE", "UNSUPPORTED_IMAGE_TYPE"], label).toContain(res.body.error.code);
    }

    const wrongField = await user.agent
      .post("/api/images")
      .attach("picture", await jpeg(), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(wrongField.status).toBe(400);
    expect(wrongField.body.error.code).toBe("INVALID_UPLOAD");

    const noFile = await user.agent.post("/api/images").send({});
    expect(noFile.status).toBe(400);
    expect(noFile.body.error.code).toBe("VALIDATION_ERROR");

    const tooBig = await upload(user.agent, Buffer.alloc(5 * 1024 * 1024 + 1024, 1), "big.jpg");
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe("FILE_TOO_LARGE");

    expect(await Image.countDocuments({ ownerId: user.id })).toBe(0);
  });

  it("serves a photo only to people who may see it, with safe headers", { timeout: 180000 }, async () => {
    const owner = await fresh("view-owner");
    const other = await fresh("view-other");
    const id = await uploadOk(owner, await noisy());

    const own = await owner.agent.get(`/api/images/${id}`);
    expect(own.status).toBe(200);
    expect(own.headers["content-type"]).toBe("image/webp");
    expect(own.headers["x-content-type-options"]).toBe("nosniff");
    expect(own.headers["cross-origin-resource-policy"]).toBe("cross-site");
    expect(own.headers["cache-control"]).toMatch(/private/);
    expect(own.body.subarray(0, 4).toString()).toBe("RIFF"); // really a WebP picture

    expect((await other.agent.get(`/api/images/${id}`)).status).toBe(404);
    expect((await request(app).get(`/api/images/${id}`)).status).toBe(404);

    const thumb = await owner.agent.get(`/api/images/${id}?size=thumb`);
    expect(thumb.status).toBe(200);
    expect(thumb.body.length).toBeLessThan(own.body.length);

    expect((await owner.agent.get(`/api/images/${id}?size=huge`)).status).toBe(400);
    expect((await owner.agent.get("/api/images/not-an-id")).status).toBe(400);
    expect((await owner.agent.get(`/api/images/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it("attaches photos to a listing, shows them by listing visibility, and removes them on archive", { timeout: 180000 }, async () => {
    const bravo = await fresh("life-seller");
    const charlie = await fresh("life-other");
    const delta = await fresh("life-admin", "admin");
    const a = await uploadOk(bravo);
    const b = await uploadOk(bravo);

    const created = await bravo.agent.post("/api/books").send(validBook({ imageKeys: [a, b] }));
    expect(created.status).toBe(201);
    expect(created.body.data.images).toEqual([a, b]);
    const bookId = created.body.data.id;

    const stored = await Image.findById(a);
    expect(String(stored.bookId)).toBe(bookId);
    expect(stored.expireAt).toBeUndefined(); // no longer on the expiry timer

    expect((await bravo.agent.get(`/api/books/${bookId}`)).body.data.images).toEqual([a, b]);

    // Pending: only the owner and admins can see the photo.
    expect((await request(app).get(`/api/images/${a}`)).status).toBe(404);
    expect((await charlie.agent.get(`/api/images/${a}`)).status).toBe(404);
    expect((await delta.agent.get(`/api/images/${a}`)).status).toBe(200);

    // Approved: everyone can.
    await approve(bookId);
    const publicView = await request(app).get(`/api/images/${a}`);
    expect(publicView.status).toBe(200);
    expect(publicView.headers["cache-control"]).toMatch(/public/);
    expect((await charlie.agent.get(`/api/images/${b}`)).status).toBe(200);

    // Archived: the photos are deleted for everyone.
    expect((await bravo.agent.delete(`/api/books/${bookId}`)).status).toBe(200);
    expect(await Image.countDocuments({ _id: mongoose.trusted({ $in: [a, b] }) })).toBe(0);
    expect((await bravo.agent.get(`/api/images/${a}`)).status).toBe(404);
    expect((await Book.findById(bookId)).imageKeys).toHaveLength(0);
  });

  it("refuses unusable photo ids and creates no listing", { timeout: 180000 }, async () => {
    const bravo = await fresh("ids-seller");
    const charlie = await fresh("ids-other");
    const mine = await uploadOk(bravo);
    const theirs = await uploadOk(charlie);
    const first = await bravo.agent.post("/api/books").send(validBook({ imageKeys: [mine] }));
    expect(first.status).toBe(201);
    const unknown = String(new mongoose.Types.ObjectId());
    const six = Array.from({ length: 6 }, () => String(new mongoose.Types.ObjectId()));

    const cases = [
      ["not a list", "abc"],
      ["not an id", ["nope"]],
      ["a number", [123]],
      ["duplicates", [unknown, unknown]],
      ["too many", six],
      ["someone else's photo", [theirs]],
      ["a photo that does not exist", [unknown]],
      ["a photo already on another listing", [mine]],
    ];
    for (const [label, imageKeys] of cases) {
      const title = `Img11 Refused ${++bookCounter}`;
      const res = await bravo.agent.post("/api/books").send(validBook({ title, imageKeys }));
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe("VALIDATION_ERROR");
      expect(await Book.countDocuments({ title }), label).toBe(0);
    }
    // Nothing was taken from the other listing or from the other person.
    expect(String((await Image.findById(mine)).bookId)).toBe(first.body.data.id);
    expect((await Image.findById(theirs)).bookId).toBeNull();
  });

  it("replaces, reorders and removes photos when a listing is edited", { timeout: 180000 }, async () => {
    const bravo = await fresh("edit-seller");
    const charlie = await fresh("edit-other");
    const [a, b, c] = [await uploadOk(bravo), await uploadOk(bravo), await uploadOk(bravo)];
    const created = await bravo.agent.post("/api/books").send(validBook({ imageKeys: [a, b, c] }));
    const id = created.body.data.id;
    await approve(id);

    const reorder = await bravo.agent.patch(`/api/books/${id}`).send({ imageKeys: [c, a] });
    expect(reorder.status).toBe(200);
    expect(reorder.body.data.images).toEqual([c, a]); // new cover first
    expect(reorder.body.data.moderationState).toBe("pending"); // a seller's edit goes back for approval
    expect(await Image.countDocuments({ _id: b })).toBe(0); // the dropped photo is deleted

    const titleOnly = await bravo.agent.patch(`/api/books/${id}`).send({ title: "Img11 Renamed" });
    expect(titleOnly.body.data.images).toEqual([c, a]); // leaving imageKeys out leaves the photos alone

    const d = await uploadOk(bravo);
    const added = await bravo.agent.patch(`/api/books/${id}`).send({ imageKeys: [c, a, d] });
    expect(added.body.data.images).toEqual([c, a, d]);
    expect(String((await Image.findById(d)).bookId)).toBe(id);

    const stranger = await charlie.agent.patch(`/api/books/${id}`).send({ imageKeys: [] });
    expect(stranger.status).toBe(404);
    expect((await Book.findById(id)).imageKeys).toHaveLength(3);

    const cleared = await bravo.agent.patch(`/api/books/${id}`).send({ imageKeys: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.images).toEqual([]);
    expect(await Image.countDocuments({ bookId: id })).toBe(0);
  });

  it("lets an admin remove a photo from a listing but never attach one", { timeout: 180000 }, async () => {
    const bravo = await fresh("adm-seller");
    const delta = await fresh("adm-admin", "admin");
    const [x, y] = [await uploadOk(bravo), await uploadOk(bravo)];
    const created = await bravo.agent.post("/api/books").send(validBook({ imageKeys: [x, y] }));
    const id = created.body.data.id;
    await approve(id);

    const adminPhoto = await uploadOk(delta);
    const attach = await delta.agent.patch(`/api/books/${id}`).send({ imageKeys: [x, y, adminPhoto] });
    expect(attach.status).toBe(400);

    const removal = await delta.agent.patch(`/api/books/${id}`).send({ imageKeys: [x] });
    expect(removal.status).toBe(200);
    expect(removal.body.data.images).toEqual([x]);
    expect((await Book.findById(id)).moderationState).toBe("approved"); // an admin edit keeps the approval
    expect(await Image.countDocuments({ _id: y })).toBe(0);
  });

  it("deletes unused uploads, but not photos that are on a listing", async () => {
    const bravo = await fresh("del-seller");
    const charlie = await fresh("del-other");
    const loose = await uploadOk(bravo);

    expect((await charlie.agent.delete(`/api/images/${loose}`)).status).toBe(404);
    expect(await Image.exists({ _id: loose })).toBeTruthy();

    const removed = await bravo.agent.delete(`/api/images/${loose}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ id: loose, deleted: true });
    expect((await bravo.agent.get(`/api/images/${loose}`)).status).toBe(404);
    expect((await bravo.agent.delete(`/api/images/${loose}`)).status).toBe(404);

    const used = await uploadOk(bravo);
    await bravo.agent.post("/api/books").send(validBook({ imageKeys: [used] })).expect(201);
    const blocked = await bravo.agent.delete(`/api/images/${used}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("IMAGE_IN_USE");
    expect(await Image.exists({ _id: used })).toBeTruthy();

    expect((await bravo.agent.delete("/api/images/not-an-id")).status).toBe(400);
  });

  it("limits how many unused uploads one person can hold", async () => {
    const user = await fresh("cap");
    const tiny = Buffer.from("x");
    await Image.insertMany(
      Array.from({ length: 20 }, () => ({
        ownerId: user.id,
        width: 100,
        height: 100,
        bytes: 1,
        full: tiny,
        thumb: tiny,
        expireAt: new Date(Date.now() + 60 * 60 * 1000),
      }))
    );
    const res = await upload(user.agent, await jpeg());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TOO_MANY_PENDING_IMAGES");
  });

  it("has an expiry index so abandoned uploads delete themselves", async () => {
    const indexes = await Image.collection.indexes();
    expect(indexes.some((index) => index.key?.expireAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
  });
});
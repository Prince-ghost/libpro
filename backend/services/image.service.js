import mongoose from "mongoose";
import sharp from "sharp";
import { AppError } from "../lib/http.js";
import { Book, Image } from "../models/index.js";

sharp.cache(false); // do not keep decoded pictures in memory between requests

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FULL_SIZE = 1200;
const THUMB_SIZE = 400;
const MAX_INPUT_PIXELS = 40_000_000; // stops "pixel bombs": small files that expand to huge pictures
const MIN_SIDE = 100;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_PENDING_UPLOADS = 20;
const PENDING_HOURS = 24;

const invalidImage = (message = "That file is not a valid image.") =>
  new AppError(400, "INVALID_IMAGE", message);
const notFound = () => new AppError(404, "NOT_FOUND", "Image not found.");

// The browser's claim about the file type is never trusted: the real content is decoded and
// re-encoded. What is stored is always a new WebP picture made by us, without hidden metadata.
async function processImage(buffer) {
  const open = () => sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

  let meta;
  try {
    meta = await open().metadata();
  } catch {
    throw invalidImage();
  }
  if (!ALLOWED_FORMATS.has(meta.format)) {
    throw new AppError(415, "UNSUPPORTED_IMAGE_TYPE", "Use a JPEG, PNG or WebP photo.");
  }
  if ((meta.pages ?? 1) > 1) {
    throw new AppError(415, "UNSUPPORTED_IMAGE_TYPE", "Animated images are not supported.");
  }
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) {
    throw invalidImage("The photo is too small. Use one that is at least 100 pixels wide and tall.");
  }

  try {
    const shrink = (size, quality) =>
      open()
        .rotate() // apply the phone's rotation, then the rotation tag is dropped with all other metadata
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .webp({ quality });
    const full = await shrink(FULL_SIZE, 78).toBuffer({ resolveWithObject: true });
    const thumb = await shrink(THUMB_SIZE, 72).toBuffer();
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch {
    throw invalidImage();
  }
}

export async function createImage(actor, buffer) {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Choose a photo to upload.", [{ field: "file", issue: "Required" }]);
  }
  const pending = await Image.countDocuments({ ownerId: actor.id, bookId: null });
  if (pending >= MAX_PENDING_UPLOADS) {
    throw new AppError(
      409,
      "TOO_MANY_PENDING_IMAGES",
      "You have too many photos that are not on a listing yet. Use or remove some first."
    );
  }

  const processed = await processImage(buffer);
  const doc = await Image.create({
    ownerId: actor.id,
    contentType: "image/webp",
    width: processed.width,
    height: processed.height,
    bytes: processed.full.length,
    full: processed.full,
    thumb: processed.thumb,
    expireAt: new Date(Date.now() + PENDING_HOURS * 60 * 60 * 1000),
  });
  return { id: String(doc._id), width: processed.width, height: processed.height };
}

// A photo can be seen by everyone if its listing is public, otherwise only by its owner and admins.
// Everyone else gets the same "not found" as for a photo that does not exist.
export async function getImageForViewer(id, actor, size) {
  const meta = await Image.findById(id).select("ownerId bookId contentType").lean();
  if (!meta) throw notFound();

  let isPublic = false;
  if (meta.bookId) {
    const book = await Book.findById(meta.bookId).select("moderationState status").lean();
    isPublic = Boolean(book) && book.moderationState === "approved" && book.status !== "archived";
  }
  const isOwner = Boolean(actor) && String(meta.ownerId) === actor.id;
  const isAdmin = Boolean(actor) && actor.role === "admin";
  if (!isPublic && !isOwner && !isAdmin) throw notFound();

  const field = size === "thumb" ? "thumb" : "full";
  const doc = await Image.findById(id).select(`+${field}`);
  if (!doc) throw notFound();
  return { data: Buffer.from(doc[field]), contentType: meta.contentType, isPublic };
}

// Only an upload that is not on a listing can be deleted here. Photos on a listing are removed by
// editing the listing.
export async function deleteImage(actor, id) {
  const result = await Image.deleteOne({ _id: id, ownerId: actor.id, bookId: null });
  if (result.deletedCount === 1) return { id: String(id), deleted: true };
  const mine = await Image.exists({ _id: id, ownerId: actor.id });
  if (mine) {
    throw new AppError(409, "IMAGE_IN_USE", "This photo is on a listing. Remove it by editing the listing.");
  }
  throw notFound(); // someone else's photo and a photo that does not exist look the same
}
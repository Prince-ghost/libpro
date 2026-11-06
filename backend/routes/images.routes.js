import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError } from "../lib/http.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import { createLimiter } from "../lib/rate-limit.js";
import { parseObjectId, parseQuery } from "../lib/validate.js";
import * as images from "../services/image.service.js";

const router = Router();

// Files are held in memory (never written to disk), limited to one file, and no extra form fields.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: images.MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
});
const uploadLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 60 });

function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError(413, "FILE_TOO_LARGE", "Photos can be at most 5 MB."));
    }
    return next(new AppError(400, "INVALID_UPLOAD", "Upload one photo, using the form field named file."));
  });
}

const sizeQuery = z.object({ size: z.enum(["full", "thumb"]).default("full") });

// Login first, so people who are not logged in never get as far as sending a file.
router.post("/", requireAuth, uploadLimiter, receiveFile, async (req, res) => {
  const image = await images.createImage(req.user, req.file?.buffer);
  res.status(201).json({ data: image, meta: { requestId: req.id } });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const id = parseObjectId(req.params.id);
  const { size } = parseQuery(sizeQuery, req.query);
  const { data, contentType, isPublic } = await images.getImageForViewer(id, req.user, size);
  res.set({
    "Content-Type": contentType,
    "Content-Length": String(data.length),
    // The website and the API are on different addresses, so the browser must be allowed to show this picture.
    // Who may fetch it is decided above, not by the browser.
    "Cross-Origin-Resource-Policy": "cross-site",
    "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-cache",
  });
  res.status(200).send(data);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = parseObjectId(req.params.id);
  res.status(200).json({ data: await images.deleteImage(req.user, id), meta: { requestId: req.id } });
});

export default router;
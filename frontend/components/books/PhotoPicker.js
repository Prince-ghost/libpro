"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES, imageUrl } from "@/lib/images";

let nextKey = 0;
const SMALL = "rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-surface disabled:opacity-60";

// Each photo is uploaded as soon as it is chosen. The listing then refers to the photos by id.
export default function PhotoPicker({ photos, setPhotos, error }) {
  const [message, setMessage] = useState("");

  function change(key, changes) {
    setPhotos((current) => current.map((p) => (p.key === key ? { ...p, ...changes } : p)));
  }

  async function upload(entry, file) {
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api("/api/images", { method: "POST", body: form });
      change(entry.key, { id: data.id, status: "ready" });
    } catch (err) {
      change(entry.key, { status: "error", error: err?.message ?? "The upload failed." });
    }
  }

  function onChoose(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // so the same file can be chosen again later
    const room = MAX_PHOTOS - photos.length;
    const problems = [];
    const accepted = [];

    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) problems.push(`${file.name} is not a JPEG, PNG or WebP image.`);
      else if (file.size > MAX_PHOTO_BYTES) problems.push(`${file.name} is larger than 5 MB.`);
      else if (accepted.length >= room) {
        const text = `You can add up to ${MAX_PHOTOS} photos.`;
        if (!problems.includes(text)) problems.push(text);
      } else accepted.push(file);
    }
    setMessage(problems.join(" "));

    const entries = accepted.map((file) => ({
      key: `new-${++nextKey}`,
      id: "",
      status: "uploading",
      name: file.name,
      preview: URL.createObjectURL(file),
      existing: false,
      error: "",
    }));
    if (entries.length > 0) setPhotos((current) => [...current, ...entries]);
    entries.forEach((entry, index) => upload(entry, accepted[index]));
  }

  async function remove(photo) {
    setMessage("");
    if (photo.preview) URL.revokeObjectURL(photo.preview);
    setPhotos((current) => current.filter((p) => p.key !== photo.key));
    // A photo uploaded in this session is not on any listing yet, so it can be deleted straight away.
    // If this fails, unused uploads are cleaned up automatically after 24 hours.
    if (!photo.existing && photo.status === "ready") {
      try {
        await api(`/api/images/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      } catch {
        // nothing to do
      }
    }
  }

  function makeCover(index) {
    setPhotos((current) => {
      const next = [...current];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
  }

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div>
      <label htmlFor="photos" className="block text-sm font-medium">
        Photos (optional)
      </label>
      <p id="photos-hint" className="mt-1 text-xs text-muted">
        Up to {MAX_PHOTOS} photos, JPEG, PNG or WebP, 5 MB each. The first photo is the cover. Photos are resized, and
        hidden data such as your location is removed.
      </p>
      <input
        id="photos"
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={full}
        onChange={onChoose}
        aria-describedby="photos-hint"
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white disabled:opacity-60"
      />
      <div aria-live="polite">
        {message && <p className="mt-2 text-sm text-danger">{message}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.key} className="rounded-xl border border-line bg-paper p-2">
              {photo.status !== "error" && (
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview || imageUrl(photo.id, "thumb")}
                    alt={`Photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <p className="mt-2 break-words text-xs">
                <span className="font-medium">
                  {photo.status === "uploading" ? "Uploading…" : photo.status === "ready" ? "Uploaded" : "Failed"}
                </span>
                {index === 0 && photo.status !== "error" && <span className="ml-2 text-brand-dark">Cover photo</span>}
              </p>
              {photo.status === "error" && <p className="mt-1 break-words text-xs text-danger">{photo.error}</p>}
              {photo.status !== "uploading" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photo.status === "ready" && index > 0 && (
                    <button type="button" onClick={() => makeCover(index)} className={SMALL}>
                      Make cover
                    </button>
                  )}
                  <button type="button" onClick={() => remove(photo)} className={`${SMALL} text-danger`}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
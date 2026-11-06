import { API_URL } from "@/lib/api";

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Where a photo can be loaded from. The server decides who is allowed to see it.
export function imageUrl(id, size) {
  return `${API_URL}/api/images/${encodeURIComponent(id)}${size === "thumb" ? "?size=thumb" : ""}`;
}
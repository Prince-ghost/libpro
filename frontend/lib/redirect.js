// After login only a path on this same site is allowed, so a crafted link like
// /login?next=https://evil.example can never send someone to another site.
export function safeNext(value) {
  if (typeof value !== "string" || value.length > 200) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\s\\]/.test(value)) return "/"; // no spaces, tabs, newlines or backslashes
  if (/^\/(login|register)(\?|$)/.test(value)) return "/"; // never loop back to the auth pages
  return value;
}
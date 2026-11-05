// Reads values from the page address safely. Anything invalid falls back to a default.
export function readPage(value) {
  const n = /^\d{1,4}$/.test(value ?? "") ? Number(value) : 1;
  return n >= 1 && n <= 1000 ? n : 1;
}

export function readChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// Builds an address, leaving out empty values to keep links short.
export function buildHref(base, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== "" && value != null) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}
import { AUDIENCE_LABELS, CONDITION_LABELS, SORT_LABELS } from "@/lib/format";

export const PAGE_SIZE = 12;
export const MAX_PRICE_RUPEES = 100000; // the API allows up to 1,00,000 rupees
const MAX_PAGE = 1000;

function cleanWholeNumber(value) {
  if (!/^\d{1,6}$/.test(value)) return "";
  const n = Number(value);
  return n <= MAX_PRICE_RUPEES ? String(n) : "";
}

// Reads the page address. Anything invalid is quietly ignored, so a hand-edited link can never break the page.
export function readBrowseParams(searchParams) {
  const get = (key) => searchParams.get(key) ?? "";
  const q = get("q").replace(/\s+/g, " ").trim().slice(0, 100);
  const audience = Object.hasOwn(AUDIENCE_LABELS, get("audience")) ? get("audience") : "";
  const condition = Object.hasOwn(CONDITION_LABELS, get("condition")) ? get("condition") : "";
  const sort = Object.hasOwn(SORT_LABELS, get("sort")) ? get("sort") : "newest";

  const rawPage = get("page");
  const pageNumber = /^\d{1,4}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1;

  let min = cleanWholeNumber(get("min"));
  let max = cleanWholeNumber(get("max"));
  if (min && max && Number(min) > Number(max)) [min, max] = [max, min];

  return { q, audience, condition, min, max, sort, page };
}

// The address for a set of values. Default values are left out to keep links short.
export function browseHref(values) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.audience) params.set("audience", values.audience);
  if (values.condition) params.set("condition", values.condition);
  if (values.min) params.set("min", values.min);
  if (values.max) params.set("max", values.max);
  if (values.sort && values.sort !== "newest") params.set("sort", values.sort);
  if (values.page > 1) params.set("page", String(values.page));
  const query = params.toString();
  return query ? `/books?${query}` : "/books";
}

// The query string sent to the API. Prices go in paise.
export function apiQueryFor(values) {
  const params = new URLSearchParams({
    page: String(values.page),
    limit: String(PAGE_SIZE),
    sort: values.sort,
  });
  if (values.q) params.set("q", values.q);
  if (values.audience) params.set("audience", values.audience);
  if (values.condition) params.set("condition", values.condition);
  if (values.min) params.set("minPrice", String(Number(values.min) * 100));
  if (values.max) params.set("maxPrice", String(Number(values.max) * 100));
  return params.toString();
}

export function hasActiveFilters(values) {
  return Boolean(values.q || values.audience || values.condition || values.min || values.max);
}
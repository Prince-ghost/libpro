const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const rupeesAndPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// The API stores money as whole paise (100 paise = 1 rupee).
export function formatPrice(priceMinor) {
  if (!Number.isFinite(priceMinor)) return "";
  return (priceMinor % 100 === 0 ? wholeRupees : rupeesAndPaise).format(priceMinor / 100);
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

export const AUDIENCE_LABELS = {
  school: "School",
  college: "College",
  competitive: "Competitive exams",
  reference: "Reference",
  other: "Other",
};
export const CONDITION_LABELS = { like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
export const SORT_LABELS = {
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};
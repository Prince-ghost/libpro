// Statuses are always written out in words, never shown by colour alone.
const WAITING = "border-amber-300 bg-amber-50 text-amber-900";
const GOOD = "border-brand/30 bg-brand/5 text-brand-dark";
const NEUTRAL = "border-line bg-paper text-muted";

export const ORDER_STATUS = {
  placed: { label: "Placed", style: WAITING },
  confirmed: { label: "Confirmed", style: GOOD },
  shipped: { label: "Shipped", style: GOOD },
  delivered: { label: "Delivered", style: GOOD },
  cancelled: { label: "Cancelled", style: NEUTRAL },
};

export const PAYMENT_STATUS = {
  unpaid: { label: "Not paid yet", style: NEUTRAL },
  paid: { label: "Paid", style: GOOD },
  refunded: { label: "Refunded", style: NEUTRAL },
};

export function countryName(code) {
  return code === "IN" ? "India" : code;
}
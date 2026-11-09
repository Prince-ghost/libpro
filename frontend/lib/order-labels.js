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

// The state of one book in an order.
export const FULFILMENT = {
  pending: { label: "Waiting to be shipped", style: WAITING },
  shipped: { label: "Shipped", style: GOOD },
  delivered: { label: "Received", style: GOOD },
};

const stateOf = (item) => item.fulfilment ?? "pending";

// The buyer's label for the whole order. Books can be in different states, so say so.
export function orderStatusOf(order) {
  if (order.status === "shipped") {
    const states = order.items.map(stateOf);
    if (states.some((state) => state === "pending")) return { label: "Partly shipped", style: WAITING };
    if (states.some((state) => state === "delivered")) return { label: "Partly received", style: GOOD };
  }
  return ORDER_STATUS[order.status] ?? { label: order.status, style: NEUTRAL };
}

// A seller only sees their own books, so their label is about those.
export function sellerStatusOf(order) {
  if (order.status === "cancelled") return ORDER_STATUS.cancelled;
  const states = order.items.map(stateOf);
  if (states.every((state) => state === "delivered")) return { label: "Received by the buyer", style: GOOD };
  if (states.some((state) => state === "pending")) return { label: "Waiting to be shipped", style: WAITING };
  return { label: "Shipped", style: GOOD };
}

export function countryName(code) {
  return code === "IN" ? "India" : code;
}
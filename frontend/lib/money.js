const MAX_PAISE = 10_000_000; // INR 1,00,000, the same limit as the API

// Turns what a person typed ("250", "150.50", "1,200") into whole paise, using integer maths only.
export function parsePrice(text) {
  const cleaned = String(text ?? "").trim().replace(/,/g, "");
  if (cleaned === "") return { error: "Enter a price." };
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return { error: "Enter a price like 250 or 150.50." };
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (paise < 1 || paise > MAX_PAISE) {
    return { error: "The price must be between ₹0.01 and ₹1,00,000." };
  }
  return { paise };
}

// 25000 becomes "250" and 15050 becomes "150.50", for pre-filling the edit form.
export function paiseToInput(paise) {
  const whole = Math.floor(paise / 100);
  const cents = paise % 100;
  return cents ? `${whole}.${String(cents).padStart(2, "0")}` : String(whole);
}
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const ADDRESS_FIELD_ORDER = ["recipientName", "phone", "line1", "line2", "city", "state", "postalCode"];

const TEXT_FIELDS = ["recipientName", "phone", "line1", "line2", "city", "state", "postalCode"];
const trimmed = (value) => String(value ?? "").trim();

export function valuesFromAddress(address) {
  return {
    recipientName: address?.recipientName ?? "",
    phone: address?.phone ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
  };
}

// These rules match the API. The server checks again, so this is only for quick feedback.
export function validateAddress(values) {
  const errors = {};

  const name = trimmed(values.recipientName);
  if (name.length < 2) errors.recipientName = "Enter the name of the person receiving the books.";
  else if (name.length > 80) errors.recipientName = "The name must be at most 80 characters.";

  const phone = trimmed(values.phone);
  const digits = phone.replace(/\D/g, "").length;
  if (!phone) errors.phone = "Enter a phone number.";
  else if (!/^\+?[0-9 ()-]+$/.test(phone) || digits < 7 || digits > 15 || phone.length > 20) {
    errors.phone = "Enter a valid phone number, for example 98765 43210.";
  }

  const line1 = trimmed(values.line1);
  if (!line1) errors.line1 = "Enter the street address.";
  else if (line1.length > 120) errors.line1 = "This line must be at most 120 characters.";
  if (trimmed(values.line2).length > 120) errors.line2 = "This line must be at most 120 characters.";

  const city = trimmed(values.city);
  if (!city) errors.city = "Enter the city or town.";
  else if (city.length > 60) errors.city = "The city must be at most 60 characters.";

  const state = trimmed(values.state);
  if (!state) errors.state = "Choose the state.";
  else if (state.length > 60) errors.state = "The state must be at most 60 characters.";

  if (!/^[1-9][0-9]{5}$/.test(trimmed(values.postalCode))) {
    errors.postalCode = "Enter a valid 6-digit PIN code.";
  }
  return errors;
}

export function buildAddressCreate(values, makeDefault) {
  const payload = {
    recipientName: trimmed(values.recipientName),
    phone: trimmed(values.phone),
    line1: trimmed(values.line1),
    city: trimmed(values.city),
    state: trimmed(values.state),
    postalCode: trimmed(values.postalCode),
    country: "IN",
  };
  const line2 = trimmed(values.line2);
  if (line2) payload.line2 = line2;
  if (makeDefault) payload.isDefault = true;
  return payload;
}

// For an edit: only what changed. An empty object means nothing changed.
export function buildAddressPatch(values, address, makeDefault) {
  const patch = {};
  for (const key of TEXT_FIELDS) {
    const next = trimmed(values[key]);
    if (next !== trimmed(address[key])) patch[key] = next;
  }
  if (makeDefault) patch.isDefault = true;
  return patch;
}
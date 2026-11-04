import { AUDIENCE_LABELS, CONDITION_LABELS } from "@/lib/format";
import { parsePrice, paiseToInput } from "@/lib/money";

export const FIELD_ORDER = [
  "title",
  "author",
  "category",
  "audience",
  "condition",
  "classOrCourse",
  "edition",
  "price",
  "description",
];

export const CATEGORY_SUGGESTIONS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "Computer Science",
  "English",
  "Economics",
  "General Knowledge",
  "Aptitude",
];

// These limits match the API. The server checks them again, so this is only for quick feedback.
const LIMITS = { title: 200, author: 120, category: 60, classOrCourse: 100, edition: 50, description: 2000 };
const LABELS = {
  title: "Title",
  author: "Author",
  category: "Category",
  classOrCourse: "Class or course",
  edition: "Edition",
  description: "Description",
};
const REQUIRED = ["title", "author", "category"];
const OPTIONAL = ["classOrCourse", "edition", "description"];
const SENT_AS_TEXT = ["title", "author", "category", "audience", "condition", "classOrCourse", "edition", "description"];

const trimmed = (value) => String(value ?? "").trim();

export function valuesFromBook(book) {
  return {
    title: book?.title ?? "",
    author: book?.author ?? "",
    category: book?.category ?? "",
    audience: book?.audience ?? "",
    condition: book?.condition ?? "",
    classOrCourse: book?.classOrCourse ?? "",
    edition: book?.edition ?? "",
    price: book ? paiseToInput(book.priceMinor) : "",
    description: book?.description ?? "",
  };
}

export function validateValues(values) {
  const errors = {};

  for (const key of REQUIRED) {
    const text = trimmed(values[key]);
    if (!text) errors[key] = `${LABELS[key]} is required.`;
    else if (text.length > LIMITS[key]) errors[key] = `${LABELS[key]} must be at most ${LIMITS[key]} characters.`;
  }
  for (const key of OPTIONAL) {
    if (trimmed(values[key]).length > LIMITS[key]) {
      errors[key] = `${LABELS[key]} must be at most ${LIMITS[key]} characters.`;
    }
  }
  if (!Object.hasOwn(AUDIENCE_LABELS, values.audience)) errors.audience = "Choose who this book is for.";
  if (!Object.hasOwn(CONDITION_LABELS, values.condition)) errors.condition = "Choose the condition of the book.";

  const price = parsePrice(values.price);
  if (price.error) errors.price = price.error;
  return errors;
}

// For a new listing: only the allowed fields are sent, and blank optional ones are left out.
export function buildCreatePayload(values) {
  const payload = {
    title: trimmed(values.title),
    author: trimmed(values.author),
    category: trimmed(values.category),
    audience: values.audience,
    condition: values.condition,
    priceMinor: parsePrice(values.price).paise,
  };
  for (const key of OPTIONAL) {
    const text = trimmed(values[key]);
    if (text) payload[key] = text;
  }
  return payload;
}

// For an edit: only what actually changed. An empty object means nothing changed.
export function buildPatch(values, book) {
  const patch = {};
  for (const key of SENT_AS_TEXT) {
    const next = trimmed(values[key]);
    if (next !== trimmed(book[key])) patch[key] = next;
  }
  const paise = parsePrice(values.price).paise;
  if (paise !== book.priceMinor) patch.priceMinor = paise;
  return patch;
}
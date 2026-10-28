import { AppError } from "./http.js";

function parse(schema, data, message) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join("."),
      issue: i.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", message, details);
  }
  return result.data; // unknown fields are stripped, never trusted
}

export const parseBody = (schema, body) =>
  parse(schema, body, "Please correct the highlighted fields.");

export const parseQuery = (schema, query) => parse(schema, query, "Invalid query parameters.");

// Strictly 24 hex characters, so odd strings never reach the database.
export function parseObjectId(id) {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid id.", [
      { field: "id", issue: "Must be a valid id" },
    ]);
  }
  return id;
}
// The one place that talks to the BookBack API.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  constructor(status, code, message, details = [], requestId = null) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 means the server could not be reached at all
    this.code = code;
    this.details = details; // [{ field, issue }] for validation errors
    this.requestId = requestId;
  }
}

export async function api(path, { method = "GET", body, signal, headers } = {}) {
  // A file upload is sent as a form. The browser adds the right content type for it by itself.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const allHeaders = { ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...headers };

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include", // sends the HttpOnly login cookie
      cache: "no-store",
      headers: Object.keys(allHeaders).length > 0 ? allHeaders : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err; // the caller cancelled on purpose
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check your connection and try again.");
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // not JSON: handled below
  }

  if (!res.ok) {
    const e = payload?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "UNKNOWN",
      e?.message ?? "Something went wrong. Please try again.",
      e?.details ?? [],
      e?.requestId ?? null
    );
  }
  return { data: payload?.data, meta: payload?.meta ?? {} };
}
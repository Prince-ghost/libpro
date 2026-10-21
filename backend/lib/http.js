import { randomUUID } from "node:crypto";

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

function sendError(req, res, status, code, message, details) {
  res.status(status).json({
    error: { code, message, ...(details && { details }), requestId: req.id },
  });
}

export function notFound(req, res) {
  sendError(req, res, 404, "NOT_FOUND", "Route not found.");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return sendError(req, res, 400, "INVALID_JSON", "Request body is not valid JSON.");
  }
  if (err.type === "entity.too.large") {
    return sendError(req, res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  if (err instanceof AppError) {
    return sendError(req, res, err.status, err.code, err.message, err.details);
  }
  // Unknown error: log a redacted line for us, send nothing internal to the client.
  console.error(
    JSON.stringify({ level: "error", requestId: req.id, name: err.name, message: err.message })
  );
  sendError(req, res, 500, "INTERNAL_ERROR", "Something went wrong.");
}
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./lib/env.js";
import { requestId, sendError, notFound, errorHandler } from "./lib/http.js";
import { isDbHealthy } from "./lib/db.js";
import { originCheck } from "./lib/csrf.js";
import authRoutes from "./routes/auth.routes.js";
import bookRoutes from "./routes/books.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(originCheck);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/api/health", async (req, res) => {
  if (!(await isDbHealthy())) {
    return sendError(req, res, 503, "DB_UNAVAILABLE", "Service temporarily unavailable.");
  }
  res.status(200).json({ data: { status: "ok" }, meta: { requestId: req.id } });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
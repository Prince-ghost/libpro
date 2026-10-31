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
import cartRoutes from "./routes/cart.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import addressRoutes from "./routes/addresses.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

app.disable("x-powered-by");
// Behind a reverse proxy the real client IP is in X-Forwarded-For. Without this every visitor
// looks like the proxy, and the rate limits would apply to all users at once.
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

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
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
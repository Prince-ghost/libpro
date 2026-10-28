import mongoose from "mongoose";
import { env, dbUri } from "./env.js";

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true); // wraps $-operators in filters so they can't be injected

function dbNameOf(uri) {
  try {
    return new URL(uri).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

// Safety net: tests delete data, so they may only run on a *_test database.
if (env.NODE_ENV === "test" && !dbNameOf(dbUri).endsWith("_test")) {
  throw new Error("Refusing to run: the test database name must end with _test");
}

// One shared connection promise for the whole process.
const cache = (globalThis.__bookbackDb ??= { promise: null });

export function connectDb() {
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(dbUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        autoIndex: env.NODE_ENV !== "production",
      })
      .catch((err) => {
        cache.promise = null; // allow a later retry
        // Log the error type only: driver messages can contain host details.
        console.error(JSON.stringify({ level: "error", event: "db_connect_failed", name: err.name }));
        throw new Error("Database connection failed");
      });
  }
  return cache.promise;
}

export async function disconnectDb() {
  cache.promise = null;
  await mongoose.disconnect();
}

export async function isDbHealthy() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
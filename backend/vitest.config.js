import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    // High limit so ordinary tests are never throttled; the rate-limit test uses its own small limiter.
    env: { AUTH_RATE_LIMIT_MAX: "1000" },
  },
});
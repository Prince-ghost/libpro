import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: { AUTH_RATE_LIMIT_MAX: "1000", ORDER_RATE_LIMIT_MAX: "1000" },
  },
});
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3100;
const API_PORT = 5100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.js",
  fullyParallel: false,
  workers: 1, // the main journey is one story, and every test shares one test database
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // The API in test mode: it can only ever use the *_test database.
      command: "node server.js",
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false, // never talk to a server you started yourself
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        CLIENT_ORIGIN: `http://localhost:${WEB_PORT}`,
        AUTH_RATE_LIMIT_MAX: "1000",
        ORDER_RATE_LIMIT_MAX: "1000",
      },
    },
    {
      // The real production build of the site, pointed at that test API.
      command: `npm run build && npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", // no Google button and no outside scripts during tests
      },
    },
  ],
});
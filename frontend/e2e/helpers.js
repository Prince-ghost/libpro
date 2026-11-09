import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, request } from "@playwright/test";

export const WEB = "http://localhost:3100";
export const API = "http://localhost:5100";
export const PASSWORD = "CorrectHorse-123";

const run = promisify(execFile);

// Makes every account and listing name unique to this run.
export const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let counter = 0;
export const uniqueEmail = (label) => `e2e.${label}.${runId}.${++counter}@example.test`;

export function newApi() {
  return request.newContext();
}

export async function apiRegister(api, { name, email, password = PASSWORD }) {
  const res = await api.post(`${API}/api/auth/register`, { data: { name, email, password } });
  if (res.status() !== 201) {
    throw new Error(`Could not create the test account ${email}: HTTP ${res.status()}`);
  }
}

// Creates an account straight through the API (faster than the form) and returns its details.
export async function createAccount(label, name) {
  const email = uniqueEmail(label);
  const api = await newApi();
  try {
    await apiRegister(api, { name, email });
  } finally {
    await api.dispose();
  }
  return { email, name };
}

// Uses the real command-line tool, pointed at the test database. It retries on connection problems,
// but never retries the safety check that it ran on a test database.
export async function promoteToAdmin(email) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { stdout } = await run(process.execPath, ["scripts/make-admin.js", email], {
        cwd: path.resolve(process.cwd(), "../backend"),
        env: { ...process.env, NODE_ENV: "test" },
        timeout: 180_000,
      });
      if (!/_test/.test(stdout)) throw new Error("make-admin did not run on a test database.");
      return;
    } catch (err) {
      lastError = err;
      if (/did not run on a test database/.test(String(err?.message))) throw err;
    }
  }
  throw lastError;
}
export async function uiLogin(page, email, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}
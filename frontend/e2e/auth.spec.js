import { test, expect } from "@playwright/test";
import { PASSWORD, WEB, createAccount, uiLogin, uniqueEmail } from "./helpers";

test("the home page reaches the API and unknown pages show the 404 page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected to the BookBack API.")).toBeVisible();
  await page.goto("/nope");
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
});

test("protected pages send visitors to the login page and bring them back", async ({ page }) => {
  const account = await createAccount("redirect", "E2E Redirect");
  await page.goto("/sell");
  await expect(page).toHaveURL(/\/login\?next=%2Fsell/);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Sell a book" })).toBeVisible();
  await expect(page).toHaveURL(/\/sell$/);
});

test("a wrong password and an unknown email get the same generic message", async ({ page }) => {
  const account = await createAccount("wrongpw", "E2E Wrong");
  await page.goto("/login");

  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill("Not-The-Password-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();

  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a login link cannot send people to another website", async ({ page }) => {
  const account = await createAccount("redirect2", "E2E Open");
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/phish")}`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(WEB);
});

test("signing up through the form logs you in, survives a refresh, and logging out works", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Newcomer");
  await page.getByLabel("Email").fill(uniqueEmail("signup"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("the session cookie is HttpOnly and nothing is kept in browser storage", async ({ page }) => {
  const account = await createAccount("cookie", "E2E Cookie");
  await uiLogin(page, account.email);

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "bookback_sid");
  expect(session).toBeTruthy();
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");

  expect(await page.evaluate(() => document.cookie)).not.toContain("bookback_sid");
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test("the sign-up form explains problems and refuses a taken email", async ({ page }) => {
  const taken = await createAccount("taken", "E2E Taken");
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Name must be at least 2 characters.")).toBeVisible();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

  await page.getByLabel("Name").fill("E2E Again");
  await page.getByLabel("Email").fill(taken.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account with this email already exists.")).toBeVisible();
});
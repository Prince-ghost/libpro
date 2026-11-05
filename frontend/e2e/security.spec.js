import { test, expect } from "@playwright/test";
import { API, apiRegister, createAccount, newApi, runId, uiLogin, uniqueEmail } from "./helpers";

test("a normal user cannot reach the admin area, in the page or in the API", async ({ page }) => {
  const account = await createAccount("plain", "E2E Plain");

  // Not logged in: the server answers 401.
  const api = await newApi();
  const anonymous = await api.get(`${API}/api/admin/users`);
  expect(anonymous.status()).toBe(401);
  await api.dispose();

  await uiLogin(page, account.email);
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "You do not have access to this page" })).toBeVisible();

  // Logged in but not an admin: the server answers 403, whatever the screen shows.
  const status = await page.evaluate(async (apiUrl) => {
    const res = await fetch(`${apiUrl}/api/admin/users`, { credentials: "include" });
    return res.status;
  }, API);
  expect(status).toBe(403);
});

// Harmless test strings: they only try to set a marker, and nothing here can do any damage.
const NAME = '<img src=x onerror="window.__xss=1">';
const TITLE = `<img src=x onerror="window.__xss=1"> <script>window.__xss=1</script> ${runId}`;
const DESCRIPTION = 'Harmless test text: <b>bold</b> <img src=x onerror="window.__xss=1">';

async function expectNoXss(page) {
  expect(await page.evaluate(() => window.__xss)).toBeUndefined(); // nothing ran
  await expect(page.locator("img[src='x']")).toHaveCount(0); // and no image tag was created
}

test("markup in names and listings is shown as plain text and never runs", async ({ page }) => {
  const email = uniqueEmail("xss");
  const api = await newApi();
  await apiRegister(api, { name: NAME, email });
  await api.dispose();
  await uiLogin(page, email);

  await page.goto("/account");
  await expect(page.getByText(NAME, { exact: true })).toBeVisible();
  await expectNoXss(page);

  await page.goto("/sell");
  await page.getByLabel("Title", { exact: true }).fill(TITLE);
  await page.getByLabel("Author", { exact: true }).fill("X. Tester");
  await page.getByLabel("Category", { exact: true }).fill("Testing");
  await page.getByLabel("Suitable for").selectOption("other");
  await page.getByLabel("Condition").selectOption("fair");
  await page.getByLabel("Price (₹)").fill("10");
  await page.getByLabel("Description (optional)").fill(DESCRIPTION);
  await page.getByRole("button", { name: "Submit listing" }).click();

  await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
  await expectNoXss(page);

  const href = await page.getByRole("link", { name: TITLE, exact: true }).getAttribute("href");
  await page.goto(href);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText(DESCRIPTION, { exact: true })).toBeVisible();
  await expectNoXss(page);

  await page.goto(`${href.replace("/books/", "/my-listings/")}/edit`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(TITLE);
  await expectNoXss(page);
});
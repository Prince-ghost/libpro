import { test, expect } from "@playwright/test";
import { WEB, createAccount, newApi, promoteToAdmin, runId, uiLogin } from "./helpers";
import { makePng } from "./png";

test.describe.configure({ mode: "serial" });

const TITLE = `E2E Photo Book ${runId}`;
let seller;
let admin;
let listingId = "";
let imageSrc = "";

async function actor(browser, account) {
  const context = await browser.newContext({ baseURL: WEB });
  const page = await context.newPage();
  return { ...account, context, page };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  seller = await actor(browser, await createAccount("photoseller", "E2E Photo Seller"));
  const adminAccount = await createAccount("photoadmin", "E2E Photo Admin");
  await promoteToAdmin(adminAccount.email);
  admin = await actor(browser, adminAccount);
});

test.afterAll(async () => {
  for (const person of [seller, admin]) await person?.context?.close();
});

test("a seller adds a photo to a new listing, and only the seller can see it while it is pending", async () => {
  const page = seller.page;
  await uiLogin(page, seller.email);
  await page.goto("/sell");
  await page.getByLabel("Title", { exact: true }).fill(TITLE);
  await page.getByLabel("Author", { exact: true }).fill("P. Tester");
  await page.getByLabel("Category", { exact: true }).fill("Physics");
  await page.getByLabel("Suitable for").selectOption("school");
  await page.getByLabel("Condition").selectOption("good");
  await page.getByLabel("Price (₹)").fill("120");
  await page
    .getByLabel("Photos (optional)")
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: makePng(300, 400) });
  await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit listing" }).click();
  await expect(page.getByText("Your listing was submitted.")).toBeVisible();

  const href = await page.getByRole("link", { name: TITLE, exact: true }).getAttribute("href");
  listingId = href.split("/").pop();

  await page.goto(`/books/${listingId}`);
  const photo = page.getByRole("img", { name: /^Photo 1 of 1/ });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0); // it really loaded
  imageSrc = await photo.getAttribute("src");
  expect(imageSrc).toMatch(/\/api\/images\/[a-f0-9]{24}$/);

  // Someone who is not logged in cannot fetch the photo of a pending listing.
  const api = await newApi();
  const anonymous = await api.get(imageSrc);
  expect(anonymous.status()).toBe(404);
  await api.dispose();
});

test("the admin sees the photo in the queue and approves, then visitors can see it", async ({ browser }) => {
  const page = admin.page;
  await uiLogin(page, admin.email);
  await page.goto("/admin/listings");
  const card = page.getByRole("listitem").filter({ hasText: TITLE }).first();
  await expect(card.getByRole("img", { name: `Photo 1 of ${TITLE}` })).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`Approved "${TITLE}".`)).toBeVisible();

  const context = await browser.newContext({ baseURL: WEB });
  const visitor = await context.newPage();
  await visitor.goto(`/books?q=${encodeURIComponent(TITLE)}`);
  const cover = visitor.locator("main ul img").first();
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);

  const response = await visitor.request.get(imageSrc);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/webp");
  await context.close();
});

test("files that are not photos are refused with a clear message", async () => {
  const page = seller.page;
  await page.goto("/sell");
  const input = page.getByLabel("Photos (optional)");

  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("notes.txt is not a JPEG, PNG or WebP image.")).toBeVisible();

  // A file that only claims to be a PNG gets past the browser check and is refused by the server.
  await input.setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is not really a picture"),
  });
  await expect(page.getByText("That file is not a valid image.")).toBeVisible();
  await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(0);
});
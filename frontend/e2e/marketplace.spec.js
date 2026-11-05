import { test, expect } from "@playwright/test";
import { API, PASSWORD, WEB, createAccount, newApi, promoteToAdmin, runId, uiLogin, uniqueEmail } from "./helpers";

// One story: each test depends on the one before it, so they run in order.
test.describe.configure({ mode: "serial" });

const BOOK_TITLE = `E2E Physics ${runId}`;
const RECEIVER = "E2E Receiver";
let listingId = "";
let orderId = "";
let seller;
let buyer;
let buyer2;
let admin;

async function actor(browser, account) {
  const context = await browser.newContext({ baseURL: WEB }); // its own cookies, like another person
  const page = await context.newPage();
  return { ...account, context, page };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  seller = await actor(browser, { email: uniqueEmail("seller"), name: "E2E Seller" });
  buyer = await actor(browser, await createAccount("buyer", "E2E Buyer"));
  buyer2 = await actor(browser, await createAccount("buyer2", "E2E Second Buyer"));
  const adminAccount = await createAccount("admin", "E2E Admin");
  await promoteToAdmin(adminAccount.email);
  admin = await actor(browser, adminAccount);
});

test.afterAll(async () => {
  for (const person of [seller, buyer, buyer2, admin]) await person?.context?.close();
});

test("a visitor can open the catalogue and search it", async ({ page }) => {
  await page.goto("/books");
  await expect(page.getByRole("heading", { name: "Browse books" })).toBeVisible();
  await page.getByLabel("Search by title, author or course").fill(`nothing-matches-${runId}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No books match your search" })).toBeVisible();
});

test("the seller signs up through the form and stays logged in", async () => {
  const page = seller.page;
  await page.goto("/register");
  await page.getByLabel("Name").fill(seller.name);
  await page.getByLabel("Email").fill(seller.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

test("the seller lists a book and it waits for approval", async () => {
  const page = seller.page;
  await page.goto("/sell");
  await page.getByLabel("Title", { exact: true }).fill(BOOK_TITLE);
  await page.getByLabel("Author", { exact: true }).fill("E. Tester");
  await page.getByLabel("Category", { exact: true }).fill("Physics");
  await page.getByLabel("Suitable for").selectOption("school");
  await page.getByLabel("Condition").selectOption("good");
  await page.getByLabel("Price (₹)").fill("250");
  await page.getByLabel("Description (optional)").fill("Used once.\nNo markings.");
  await page.getByRole("button", { name: "Submit listing" }).click();

  await expect(page).toHaveURL(/\/my-listings/);
  await expect(page.getByText("Your listing was submitted.")).toBeVisible();
  const card = page.getByRole("listitem").filter({ hasText: BOOK_TITLE }).first();
  await expect(card.getByText("Waiting for approval")).toBeVisible();

  const href = await page.getByRole("link", { name: BOOK_TITLE, exact: true }).getAttribute("href");
  listingId = href.split("/").pop();
  expect(listingId).toMatch(/^[a-f0-9]{24}$/);
});

test("the pending listing is hidden from the public", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: WEB });
  const page = await context.newPage();
  await page.goto(`/books?q=${encodeURIComponent(BOOK_TITLE)}`);
  await expect(page.getByRole("heading", { name: "No books match your search" })).toBeVisible();
  await page.goto(`/books/${listingId}`);
  await expect(page.getByRole("heading", { name: "Book not found" })).toBeVisible();
  await context.close();
});

test("an admin approves the listing in the admin screen", async () => {
  const page = admin.page;
  await uiLogin(page, admin.email);
  await page.goto("/admin/listings");
  const card = page.getByRole("listitem").filter({ hasText: BOOK_TITLE }).first();
  await expect(card.getByText("Waiting for approval")).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`Approved "${BOOK_TITLE}".`)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: BOOK_TITLE })).toHaveCount(0);
});

test("the approved book is public and shows as Live to the seller", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: WEB });
  const page = await context.newPage();
  await page.goto(`/books?q=${encodeURIComponent(BOOK_TITLE)}`);
  await page.getByRole("heading", { name: BOOK_TITLE }).click();
  await expect(page).toHaveURL(new RegExp(`/books/${listingId}`));
  await expect(page.getByRole("heading", { level: 1, name: BOOK_TITLE })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in to add to cart" })).toBeVisible();
  await context.close();

  await seller.page.goto("/my-listings");
  const card = seller.page.getByRole("listitem").filter({ hasText: BOOK_TITLE }).first();
  await expect(card.getByText("Live", { exact: true })).toBeVisible();
});

test("a buyer adds the book to the cart and places an order", async () => {
  const page = buyer.page;
  await uiLogin(page, buyer.email);
  await page.goto(`/books/${listingId}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("In your cart")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByLabel("Full name").fill(RECEIVER);
  await page.getByLabel("Phone number").fill("98765 43210");
  await page.getByLabel("Address line 1").fill("12 Test Street");
  await page.getByLabel("City or town").fill("Jalandhar");
  await page.getByLabel("State").selectOption("Punjab");
  await page.getByLabel("PIN code").fill("144001");
  await page.getByRole("button", { name: "Save and use this address" }).click();
  await expect(page.getByRole("radio")).toBeChecked();

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}/);
  await expect(page.getByText("Your order was placed.")).toBeVisible();
  await expect(page.getByText("Not paid yet").first()).toBeVisible();
  // The server worked out this total: INR 250 for the book plus the flat INR 40 shipping
  // set in backend/services/order.service.js. If that shipping rule changes, update this line.
  await expect(page.getByText("₹290", { exact: true })).toBeVisible();

  orderId = new URL(page.url()).pathname.split("/").pop();
  expect(orderId).toMatch(/^[a-f0-9]{24}$/);
});

test("a second buyer cannot buy the reserved book", async () => {
  const page = buyer2.page;
  await uiLogin(page, buyer2.email);
  await page.goto(`/books/${listingId}`);
  await expect(page.getByText("This book is reserved for another buyer.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);

  // Even a hand-made request is refused by the server.
  const status = await page.evaluate(
    async ({ api, id }) => {
      const res = await fetch(`${api}/api/cart/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id }),
      });
      return res.status;
    },
    { api: API, id: listingId }
  );
  expect(status).toBe(409);
});

test("the seller sees the order but not the buyer's contact details", async () => {
  const page = seller.page;
  await page.goto("/sales");
  const card = page.getByRole("listitem").filter({ hasText: BOOK_TITLE }).first();
  await card.getByRole("link", { name: "View order" }).click();
  await expect(page.getByText("Deliver to")).toBeVisible();
  await expect(page.getByText(RECEIVER)).toBeVisible();
  await expect(page.getByText("12 Test Street")).toBeVisible();

  const text = await page.locator("main").innerText();
  expect(text).not.toContain("98765"); // the buyer's phone number
  expect(text).not.toContain(buyer.email);
});

test("the buyer cancels the order and the book returns to the catalogue", async ({ browser }) => {
  const page = buyer.page;
  await page.goto(`/orders/${orderId}`);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  const context = await browser.newContext({ baseURL: WEB });
  const visitor = await context.newPage();
  await visitor.goto(`/books/${listingId}`);
  await expect(visitor.getByText("Available", { exact: true })).toBeVisible();
  await context.close();

  await seller.page.goto(`/sales/${orderId}`);
  await expect(seller.page.getByText("The delivery address is hidden")).toBeVisible();
});

test("an admin disables an account, the person is logged out, and the audit log shows it", async () => {
  const page = admin.page;
  await page.goto("/admin/users");
  await page.getByLabel("Find an account by its full email address").fill(buyer2.email);
  await page.getByRole("button", { name: "Search", exact: true }).click();

  const card = page.getByRole("listitem").filter({ hasText: buyer2.email }).first();
  await card.getByRole("button", { name: "Disable account" }).click();
  await page.getByRole("button", { name: "Yes, disable it" }).click();
  await expect(card.getByText("Disabled", { exact: true })).toBeVisible();

  await buyer2.page.reload();
  await expect(buyer2.page.getByRole("link", { name: "Log in" })).toBeVisible();

  const api = await newApi();
  const login = await api.post(`${API}/api/auth/login`, { data: { email: buyer2.email, password: PASSWORD } });
  expect(login.status()).toBe(401);
  await api.dispose();

  await page.goto("/admin/audit");
  await expect(page.getByText("Listing moderated").first()).toBeVisible();
  await expect(page.getByText("Account status changed").first()).toBeVisible();
});
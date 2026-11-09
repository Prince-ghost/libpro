import { test, expect } from "@playwright/test";
import { WEB, createAccount, promoteToAdmin, runId, uiLogin } from "./helpers";
import { apiLogin, approveListing, createListing, placeOrderFor } from "./api-helpers";

test.describe.configure({ mode: "serial" });

const SHIP_TITLE = `E2E Fulfil ${runId}`;
const REJECT_TITLE = `E2E Rejected ${runId}`;
const REASON = "Cover photo is blurry";
let seller;
let buyer;
let admin;
let orderId = "";
let bookId = "";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  const accounts = {
    seller: await createAccount("fseller", "E2E Fulfil Seller"),
    buyer: await createAccount("fbuyer", "E2E Fulfil Buyer"),
    admin: await createAccount("fadmin", "E2E Fulfil Admin"),
  };
  await promoteToAdmin(accounts.admin.email);

  const connect = async (account) => {
    const context = await browser.newContext({ baseURL: WEB });
    return { ...account, context, page: await context.newPage(), api: await apiLogin(account.email) };
  };
  seller = await connect(accounts.seller);
  buyer = await connect(accounts.buyer);
  admin = await connect(accounts.admin);

  // Set up through the API, so the browser tests below can focus on what is being tested.
  bookId = await createListing(seller.api, SHIP_TITLE);
  await approveListing(admin.api, bookId);
  orderId = await placeOrderFor(buyer.api, bookId);
});

test.afterAll(async () => {
  for (const person of [seller, buyer, admin]) {
    await person?.context?.close();
    await person?.api?.dispose();
  }
});

test("the seller marks the order as shipped", async () => {
  const page = seller.page;
  await uiLogin(page, seller.email);
  await page.goto(`/sales/${orderId}`);
  await expect(page.getByText("Waiting to be shipped").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await page.getByRole("button", { name: "Yes, mark as shipped" }).click();
  await expect(page.getByText("Marked as shipped. The buyer can now confirm when it arrives.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as shipped" })).toHaveCount(0);
  await expect(page.getByText("Shipped", { exact: true }).first()).toBeVisible();
});

test("the buyer sees it shipped and can no longer cancel", async () => {
  const page = buyer.page;
  await uiLogin(page, buyer.email);
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText("Shipped", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I have received this book" })).toBeVisible();
});

test("the buyer confirms receipt and the book is sold", async ({ browser }) => {
  const page = buyer.page;
  await page.getByRole("button", { name: "I have received this book" }).click();
  await page.getByRole("button", { name: "Yes, I received it" }).click();
  await expect(page.getByText("Thanks. Marked as received.")).toBeVisible();
  await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Received", { exact: true }).first()).toBeVisible();

  const context = await browser.newContext({ baseURL: WEB });
  const visitor = await context.newPage();
  await visitor.goto(`/books/${bookId}`);
  await expect(visitor.getByText("Sold", { exact: true }).first()).toBeVisible();
  await context.close();
});

test("a rejected listing shows the admin's reason to the seller", async () => {
  const rejectedId = await createListing(seller.api, REJECT_TITLE);

  const adminPage = admin.page;
  await uiLogin(adminPage, admin.email);
  await adminPage.goto("/admin/listings");
  const card = adminPage.getByRole("listitem").filter({ hasText: REJECT_TITLE }).first();
  await card.getByRole("button", { name: "Reject" }).click();
  await adminPage.getByLabel("Why is this listing being rejected?").fill(REASON);
  await adminPage.getByRole("button", { name: "Reject listing" }).click();
  await expect(adminPage.getByText(`Rejected "${REJECT_TITLE}".`)).toBeVisible();

  const sellerPage = seller.page;
  await sellerPage.goto("/my-listings");
  const mine = sellerPage.getByRole("listitem").filter({ hasText: REJECT_TITLE }).first();
  await expect(mine.getByText("Not approved")).toBeVisible();
  await expect(mine.getByText(`Reason: ${REASON}`)).toBeVisible();

  await sellerPage.goto(`/my-listings/${rejectedId}/edit`);
  await expect(sellerPage.getByText(`Reason given: ${REASON}`)).toBeVisible();
});
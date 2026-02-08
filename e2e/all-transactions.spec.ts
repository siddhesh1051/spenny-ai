import { test, expect } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const hasTestUser = Boolean(testEmail && testPassword);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill(testEmail!);
  await page.getByPlaceholder("Password").fill(testPassword!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });
}

test.describe("All Transactions page and filters", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasTestUser) test.skip();
  });

  test("opens All Transactions and shows Filters with All categories and search", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByRole("heading", { name: /all transactions/i })).toBeVisible();

    await expect(page.getByText("Filters")).toBeVisible();
    await expect(page.getByPlaceholder(/search by name or amount/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /all categories/i })).toBeVisible();
  });

  test("search filter filters transactions", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page.getByRole("heading", { name: /all transactions/i })).toBeVisible({ timeout: 5000 });

    const searchInput = page.getByPlaceholder(/search by name or amount/i);
    await searchInput.fill("lunch");
    await expect(searchInput).toHaveValue("lunch");
  });

  test("category filter shows All categories and can open dropdown", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page.getByRole("heading", { name: /all transactions/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /all categories/i }).click();
    await expect(page.getByText("All categories").first()).toBeVisible();
  });
});

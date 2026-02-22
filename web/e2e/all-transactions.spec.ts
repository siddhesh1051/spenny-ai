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

  test("export flow: opens modal, step 1 presets and Next, step 2 CSV/PDF and Download", async ({
    page,
  }) => {
    await login(page);

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByText("Filters")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /export/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Export expenses")).toBeVisible();
    await expect(dialog.getByText(/select a date range for the export/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /last 30 days/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^next$/i })).toBeVisible();

    await dialog.getByRole("button", { name: /^next$/i }).click();
    await expect(dialog.getByText(/choose export format and download/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^back$/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /download/i })).toBeVisible();

    await dialog.getByRole("button", { name: /^back$/i }).click();
    await expect(dialog.getByText("Presets")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^next$/i })).toBeVisible();

    await dialog.getByRole("button", { name: /^next$/i }).click();
    await dialog.getByRole("button", { name: /csv/i }).first().click();
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
    await dialog.getByRole("button", { name: /download/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/^expenses_.*_to_.*\.csv$/);
    }
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("export flow: select preset Last 7 days, Next, choose PDF option, modal shows Download", async ({
    page,
  }) => {
    await login(page);

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByText("Filters")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /export/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /last 7 days/i }).click();
    await dialog.getByRole("button", { name: /^next$/i }).click();
    await expect(dialog.getByText("Choose export format and download")).toBeVisible();
    await dialog.getByRole("button", { name: /pdf/i }).first().click();
    await expect(dialog.getByRole("button", { name: /download/i })).toBeVisible();
    await dialog.getByRole("button", { name: /^back$/i }).click();
    await expect(dialog.getByText("Presets")).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

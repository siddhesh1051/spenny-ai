import { test, expect } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const hasTestUser = Boolean(testEmail && testPassword);

test.describe("Manual expense addition", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasTestUser) test.skip();
  });

  test("sign in → home → add expense manually → transactions page", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Email").fill(testEmail!);
    await page.getByPlaceholder("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/click the mic or button to start/i)).toBeVisible();

    await page.getByRole("button", { name: /add manually/i }).click();
    await expect(page.getByRole("dialog", { name: /add expenses manually/i })).toBeVisible();
    await page.getByPlaceholder(/enter expenses here/i).fill("50 for lunch and 100 for groceries");
    await page.getByRole("button", { name: /save expenses/i }).click();

    await expect(page.getByRole("dialog", { name: /add expenses manually/i })).not.toBeVisible({ timeout: 15000 });

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByRole("heading", { name: /all transactions/i })).toBeVisible({ timeout: 5000 });
  });

  test("signed-in user sees sidebar and can navigate to transactions", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Email").fill(testEmail!);
    await page.getByPlaceholder("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole("link", { name: /all transactions/i }).click();
    await expect(page).toHaveURL(/\/transactions/);
  });
});

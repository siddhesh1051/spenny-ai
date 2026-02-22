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

test.describe("Analytics, Settings, WhatsApp Integration pages", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasTestUser) test.skip();
  });

  test("Analytics page loads", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /analytics/i }).click();
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
  });

  test("Settings page loads", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("WhatsApp Integration page loads", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /whatsapp integration/i }).click();
    await expect(page).toHaveURL(/\/whatsapp-integration/);
    await expect(page.getByText("WhatsApp Integration")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Auth page", () => {
  test("shows auth page when not logged in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome")).toBeVisible();
    await expect(page.getByRole("tab", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /sign up/i })).toBeVisible();
  });

  test("Sign In tab has email and password inputs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: /sign in/i }).click();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  });

  test("Sign Up tab has email and password inputs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: /sign up/i }).click();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up", exact: true })).toBeVisible();
  });

  test("shows error when signing in with invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Email").fill("e2e-invalid@example.com");
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    // Supabase: "Invalid login credentials"; CI placeholder may show "Failed to fetch" or similar
    await expect(
      page.getByText(/invalid|credentials|error|failed|fetch/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("Google sign in button is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });
});

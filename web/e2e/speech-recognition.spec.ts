import { test, expect, Page } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const hasTestUser = Boolean(testEmail && testPassword);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function setupSpeechMocks(page: Page) {
  await page.addInitScript(() => {
    // Mock getUserMedia
    (navigator.mediaDevices as any).getUserMedia = () => {
      return Promise.resolve({
        getTracks: () => [{ stop: () => {} }]
      });
    };

    // Mock SpeechRecognition
    class MockSpeechRecognition {
      lang = 'en-US';
      interimResults = true;
      maxAlternatives = 3;
      continuous = true;
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      onresult: any = null;
      
      start() {
        setTimeout(() => {
          if (this.onstart) {
            this.onstart(new Event('start'));
          }
          
          // Simulate INTERIM result first (for live transcript)
          setTimeout(() => {
            if (this.onresult) {
              const resultEvent: any = new Event('result');
              resultEvent.results = [
                [{ transcript: 'spent 50 on coffee', confidence: 0.9, isFinal: false }]
              ];
              resultEvent.resultIndex = 0;
              this.onresult(resultEvent);
            }
            
            // Then simulate final result
            setTimeout(() => {
              if (this.onresult) {
                const resultEvent: any = new Event('result');
                resultEvent.results = [
                  [{ transcript: 'spent 50 on coffee', confidence: 0.95, isFinal: true }]
                ];
                resultEvent.resultIndex = 0;
                this.onresult(resultEvent);
              }
              
              setTimeout(() => {
                if (this.onend) {
                  this.onend(new Event('end'));
                }
              }, 100);
            }, 300);
          }, 200);
        }, 50);
      }
      
      stop() {
        if (this.onend) this.onend(new Event('end'));
      }
      
      abort() {}
    }
    
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    
    // Mock fetch for Groq API
    const originalFetch = window.fetch;
    (window as any).fetch = function(url: string, options?: any) {
      if (url.includes('api.groq.com') || url.includes('groq')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify([{
                  amount: 50,
                  category: 'food',
                  description: 'Coffee'
                }])
              }
            }]
          })
        });
      }
      return originalFetch(url, options);
    };
  });
}

async function setupSpeechMocksWithError(page: Page) {
  await page.addInitScript(() => {
    // Mock getUserMedia
    (navigator.mediaDevices as any).getUserMedia = () => {
      return Promise.resolve({
        getTracks: () => [{ stop: () => {} }]
      });
    };

    // Mock SpeechRecognition with error
    class MockSpeechRecognition {
      onstart: any = null;
      onerror: any = null;
      
      start() {
        setTimeout(() => {
          if (this.onstart) this.onstart(new Event('start'));
          setTimeout(() => {
            if (this.onerror) {
              const errorEvent: any = new Event('error');
              errorEvent.error = 'no-speech';
              this.onerror(errorEvent);
            }
          }, 500);
        }, 50);
      }
      stop() {}
    }
    
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

test.describe("Speech Recognition", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasTestUser) test.skip();
  });

  test("microphone button is visible on home page", async ({ page }) => {
    await page.goto("/");

    // Sign in
    await page.getByPlaceholder("Email").fill(testEmail!);
    await page.getByPlaceholder("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Wait for home page
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });
    
    // Check microphone button is visible
    const micButton = page.locator('button[class*="rounded-full"]').first();
    await expect(micButton).toBeVisible();
  });

  test("shows live transcript during speech recognition", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    await setupSpeechMocks(page);
    
    await page.goto("/");

    // Sign in
    await page.getByPlaceholder("Email").fill(testEmail!);
    await page.getByPlaceholder("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });

    // Click microphone button
    const micButton = page.locator('button[class*="rounded-full"]').first();
    await micButton.click();
    
    // Check for interim transcript display while recording
    await expect(page.getByText(/you're saying/i)).toBeVisible({ timeout: 1000 });
    await expect(page.getByText(/spent 50 on coffee/i)).toBeVisible({ timeout: 1000 });
  });

  test("handles speech recognition errors gracefully", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    await setupSpeechMocksWithError(page);
    
    await page.goto("/");

    // Sign in
    await page.getByPlaceholder("Email").fill(testEmail!);
    await page.getByPlaceholder("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 15000 });

    // Click microphone
    const micButton = page.locator('button[class*="rounded-full"]').first();
    await micButton.click();

    // Should show error message
    await expect(page.getByText(/no speech detected/i)).toBeVisible({ timeout: 3000 });
  });
});

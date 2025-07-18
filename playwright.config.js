// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true, // Keep this as true if you plan to have multiple .spec.js files
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  // ----------------------------------------------------------------------
  // ADD OR UPDATE THIS LINE:
  // Sets the default timeout for each test in milliseconds.
  // 1 hour = 3600000 ms, 3 hours = 10800000 ms, 5 hours = 18000000 ms.
  // Choose a value generously based on your expected total run time for all 4000+ URLs.
  timeout: 1 * 60 * 60 * 1000, // Example: 5 hours (adjust as needed, could be more or less)
  // ----------------------------------------------------------------------

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ... rest of your config ...
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Expeditoo QA Testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /* Global timeout for each test */
  timeout: 5 * 60 * 1000, 

  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * Increased to 30s for slow environment.
     */
    timeout: 30 * 1000,
  },

  testDir: './testing/scripts',
  
  /* Global setup - login once, reuse auth state */
  globalSetup: './testing/global-setup.ts',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Workers: Reduced to 2 to prevent overloading the slow dev server */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use */
  reporter: [
    ['./testing/lib/expedito-reporter.ts'],
    ['html', { outputFolder: 'testing/reports/html' }],
    ['list']
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:3000',

    /* Increased timeouts for slow environment */
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video recording */
    video: 'retain-on-failure',
  },
  outputDir: 'testing/results/test-results',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

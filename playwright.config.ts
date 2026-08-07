import { defineConfig, devices } from '@playwright/test';

/**
 * 06_TASKS.md M9-016 ("Complete Desktop End-to-End Suite") —
 * "Capture useful failure artifacts." Before this batch, `use` only set
 * `trace: 'on-first-retry'`; a failure with no retry configured (the
 * local, non-CI default — `retries: 0` above) produced no trace,
 * screenshot, or video at all, only the bare assertion error text. Adding
 * `screenshot: 'only-on-failure'` and `video: 'retain-on-failure'` closes
 * that gap without adding overhead to passing runs (both settings are
 * failure-conditional, the same "only-on-failure" idiom `trace` already
 * used).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This sandbox pre-installs Chromium at a fixed path instead of letting
        // Playwright download a build matched to @playwright/test's version.
        launchOptions: {
          executablePath: '/opt/pw-browsers/chromium',
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});

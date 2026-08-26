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
 *
 * **`chromium`'s `launchOptions.executablePath` removed — R1-3 ("Runtime
 * Pinning + Production CI Smoke Gate").** The previous hardcoded
 * `/opt/pw-browsers/chromium` path only exists inside one specific local
 * development sandbox; on a real CI runner (or any other machine) that
 * path does not exist and every test would fail to launch a browser at
 * all — the exact reason `pnpm test:e2e` could never run in
 * `.github/workflows/ci.yml` (see `docs/OPERATIONAL_RUNBOOK.md`'s
 * former "Known operational limitations" entry, closed by this batch's
 * production smoke gate). Playwright's own browser resolution already
 * honors the standard `PLAYWRIGHT_BROWSERS_PATH` environment variable
 * with no code needed here — set it, and Playwright finds a browser
 * there; leave it unset (the default on a fresh `playwright install`,
 * including in CI) and Playwright uses its own standard cache location.
 * Removing the hardcoded path makes this config portable across both
 * without special-casing either.
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
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /**
   * `timeout` made explicit — R1-3. Previously relied on Playwright's
   * own unstated default (60 seconds); a genuine `next start` boot
   * takes a few seconds, so 60s comfortably bounds normal startup while
   * still guaranteeing a deterministic failure (not an indefinite hang)
   * if the production server never becomes ready — the CI job fails
   * loudly rather than stalling until the whole workflow's own runner
   * timeout eventually kills it. Playwright tears down the spawned
   * `pnpm start` process automatically once the test run exits, whether
   * that's a pass, a failure, or this startup timeout — no manual
   * process cleanup needed here or in CI.
   */
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

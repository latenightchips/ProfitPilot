import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Offline Application Usage End-to-End Tests — 06_TASKS.md M9-015
 * ("Define Critical End-to-End Workflows") Include: "Use application
 * offline." Genuinely missing before this batch — confirmed by direct
 * search of `tests/e2e/` before writing this file: no occurrence of
 * `context.setOffline`, `navigator.onLine`, or "offline" anywhere.
 *
 * **Not a speculative feature test — a structural consequence of this
 * application's own already-documented architecture.** `01_PRD.md`
 * REQ-010 ("Manual Mode") means no live price/protocol data provider is
 * ever fetched at runtime (`app/page.tsx`'s own "Refresh" copy: "no live
 * price or protocol data provider is connected"); Milestone 8's
 * local-only re-scope (`docs/MILESTONE_8_SCOPE_CHANGE.md`, Conflict #34)
 * means no cloud persistence or synchronization exists to fail when
 * offline either.
 *
 * **The warm-up walks the exact click path the offline portion repeats,
 * not a set of bare `page.goto()` calls — found empirically, not
 * assumed.** An earlier version of this test warmed each route with
 * `page.goto(route, ...)` before going offline; every one of those
 * routes still failed with `net::ERR_INTERNET_DISCONNECTED` on the very
 * next real `<Link>` click once offline. A `page.goto()` is itself a
 * hard, full-document navigation — it does not populate the same
 * client-side transition Next.js's router uses for an in-app `<Link>`
 * click, so it left the *next* soft navigation with nothing to reuse.
 * Clicking through the real workflow once while online first (creating
 * a throwaway "Warmup Portfolio") populates that router-level cache for
 * the exact transitions the real, offline-created "Offline Portfolio"
 * workflow below then repeats — the same real-world shape as a user who
 * has already been using the app for a while before losing connectivity,
 * not a user's very first cold load.
 */
async function fillByLabel(page: Page, labelText: string, value: string) {
  const label = page.locator('label', { hasText: labelText });
  const input = label.locator('input, select, textarea');
  await input
    .first()
    .fill(value)
    .catch(async () => {
      await input.first().selectOption(value);
    });
}

async function createPortfolioViaClicks(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio' })
    .click();

  const selectOrCreate = page.getByRole('link', { name: 'Select or create one' });
  if ((await selectOrCreate.count()) > 0) {
    await selectOrCreate.click();
    await page.waitForURL('**/portfolios');
    await page.getByRole('link', { name: 'Create Portfolio' }).first().click();
  } else {
    // An active portfolio already exists (the warm-up already ran) —
    // reach the create form via the portfolios list instead.
    await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
    await page.waitForURL('**/portfolios');
    await page.getByRole('link', { name: 'Create Portfolio' }).first().click();
  }
  await page.waitForURL('**/portfolios/new');

  await fillByLabel(page, 'Portfolio name', name);
  await fillByLabel(page, 'BTC quantity', '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
  await expect(page.getByRole('status')).toHaveText('Saved');
}

test('Cover: Use application offline — create a portfolio and run a simulation with no network connectivity (M9-015)', async ({
  page,
  context,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Warm-up: walk the exact click path once while online (see this
  // file's own header comment for why `page.goto()` alone does not
  // achieve this).
  await createPortfolioViaClicks(page, 'Warmup Portfolio');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await context.setOffline(true);

  await createPortfolioViaClicks(page, 'Offline Portfolio');
  // `autoSaveCoordinator`'s debounced write is `localStorage`-only —
  // reaches "Saved" with no network at all, proving persistence itself
  // has no hidden network dependency (asserted inside
  // `createPortfolioViaClicks` above already, while genuinely offline).

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  // 2 BTC * $65,000 − $20,000 debt = $110,000. The Engine computes this
  // entirely client-side (`engine/` has no fetch of its own anywhere) —
  // a real result while genuinely offline, not a cached/stale figure.
  await expect(page.getByText('$110,000.00')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Offline Portfolio' })).toBeVisible();

  await context.setOffline(false);
});

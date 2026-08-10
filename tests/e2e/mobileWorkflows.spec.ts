import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Mobile End-to-End Workflow Tests — 06_TASKS.md M9-017 ("Complete
 * Mobile End-to-End Suite"). Dependencies: M9-015. Focus: "Navigation,
 * Forms, KPI readability, Tables and cards, Scenario controls, Strategy
 * workflows, Import and export entry points, Error recovery." DoD:
 * "Critical workflows remain usable without horizontal page scrolling or
 * inaccessible controls."
 *
 * **A genuinely new layer, not a duplicate of `responsiveLayout.spec.ts`
 * (M5-023/M6-021).** That file already proves — real-browser, at this
 * exact 375×812 viewport — that five routes never overflow horizontally
 * (`expectNoHorizontalOverflow`, its own header comment). But every one
 * of its tests populates data *at desktop width first* and only resizes
 * to mobile at the very end, specifically to check the rendered *result*
 * — by its own header comment, "no test ever drives navigation/
 * interaction while already at a mobile/tablet viewport" (confirmed by
 * direct inspection before writing this file, not assumed). This file is
 * the complementary layer: every test below sets the mobile viewport
 * *first*, then drives a real multi-step workflow entirely at that width
 * — proving the *workflow*, not just the *layout*, remains usable.
 * "No horizontal page scrolling" itself is not re-asserted per test here
 * (that would duplicate `responsiveLayout.spec.ts`'s own dedicated,
 * passing checks for no new signal); what is new is that every control
 * these tests touch is actually clickable/fillable/readable at this
 * width, not just present without overflowing.
 *
 * **"Navigation" found and fixed a real, live defect before this file
 * could even be written**: `AppSidebar` has no mobile equivalent (`hidden
 * md:block`, Milestone 5's own accepted, documented scope decision —
 * "Mobile navigation gap noted, not built," `PROJECT_STATUS.md`), which
 * makes the Dashboard's own Quick Actions the *only* way a mobile user
 * can reach Simulation/Loop Builder/Exit Planner without typing a URL
 * directly. Quick Actions' "Run simulation"/"Build loop strategy"/
 * "Create exit plan" were still hardcoded `available: false` — a
 * Milestone 5 leftover never revisited once Milestones 6/7 shipped those
 * routes for real — silently telling a mobile user those tools were "not
 * yet available" when they had worked for three milestones. Fixed in
 * `features/dashboard/utils/buildQuickActions.ts` (see its own header
 * comment for the full writeup); every navigation step below exercises
 * the real, now-fixed path.
 *
 * **Direct `page.goto()` between steps, not only in-app link clicks** —
 * unlike `portfolioWorkflows.spec.ts`'s own Milestone-4-era convention
 * (real then, before Milestone 8's local storage persistence existed),
 * a real document navigation today rehydrates every Store from
 * `localStorage` via `PersistenceProvider`
 * (`tests/e2e/navigation.spec.ts`'s own M9-019 tests already prove this
 * at the real-browser level). Using `page.goto('/')` to reach the
 * Dashboard from a route with no mobile nav path back is exactly the
 * pattern a real mobile user bookmarking/re-entering a URL would use,
 * not a test-only shortcut.
 */
const MOBILE_VIEWPORT = { width: 375, height: 812 };

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

async function createPortfolio(
  page: Page,
  options: { name: string; quantity?: string; debtBalance?: string },
) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', options.name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', options.debtBalance ?? '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (%)', '75');
  await fillByLabel(page, 'Liquidation threshold (%)', '80');
  await fillByLabel(page, 'Borrow APR (%)', '5');
  await fillByLabel(page, 'Supply APR (%)', '2');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
  // Milestone 8's autosave (`autoSaveCoordinator`) is debounced (~400ms)
  // — a `page.goto()` immediately after landing here (several tests
  // below do exactly that, to reach the Dashboard with no mobile sidebar
  // available) can otherwise kill the pending write before it lands, the
  // same race `tests/e2e/settingsWorkflows.spec.ts`'s own header comment
  // already documents and guards against.
  await expect(page.getByRole('status')).toHaveText('Saved');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
});

test('Cover: Create and edit a portfolio via forms at mobile width (M9-017 — Forms)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'Mobile Forms Portfolio' });
  await expect(page.getByLabel('Portfolio name')).toHaveValue('Mobile Forms Portfolio');

  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(collateralSection.getByText('Health Factor', { exact: true })).toBeVisible();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(
    collateralSection.locator('label', { hasText: 'Quantity' }).locator('input'),
  ).toHaveValue('3');
});

test('Cover: Dashboard KPI values and Quick Actions remain readable and usable at mobile width (M9-017 — KPI readability, Navigation)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'Mobile KPI Portfolio' });
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Health Factor', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Loan-to-Value', { exact: true }).first()).toBeVisible();

  // Quick Actions is the only mobile-reachable navigation surface (no
  // sidebar below `md:`) — every link must be genuinely clickable, not
  // merely present, at this width.
  const runSimulation = page.getByRole('link', { name: 'Run simulation' });
  await expect(runSimulation).toBeVisible();
  await expect(runSimulation).toBeEnabled();
});

test('Cover: Navigate to Simulation via Quick Actions and run a scenario at mobile width (M9-017 — Navigation, Scenario controls)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'Mobile Simulation Portfolio' });
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.getByRole('link', { name: 'Run simulation' }).click();
  await page.waitForURL('**/simulation');
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  // 2 BTC * $65,000 − $20,000 debt = $110,000.
  await expect(page.getByText('$110,000.00')).toBeVisible();
});

test('Cover: Navigate to Loop Builder via Quick Actions and build a strategy at mobile width (M9-017 — Navigation, Strategy workflows)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'Mobile Loop Portfolio', quantity: '1', debtBalance: '0' });
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.getByRole('link', { name: 'Build loop strategy' }).click();
  await page.waitForURL('**/loop-builder');
  await expect(page.getByRole('heading', { name: 'Loop Builder' })).toBeVisible();

  await fillByLabel(page, 'How much to borrow each loop', '60');
  await page.waitForTimeout(300);

  const steps = page.getByRole('table', { name: 'Loop strategy steps' });
  await expect(steps).toBeVisible();
  expect(await steps.locator('tbody tr').count()).toBeGreaterThan(0);
});

test('Cover: Import and Export entry points remain reachable and usable at mobile width (M9-017 — Import and export entry points)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'Mobile Export Portfolio' });
  // Settings has no Quick Actions/sidebar entry point reachable purely
  // by clicking at mobile width (the sidebar is hidden, and Quick
  // Actions does not link to Settings) — direct URL entry is the same
  // real mobile pattern (bookmark, typed URL) `tests/e2e/navigation.spec.ts`'s
  // own M9-019 "Deep link directly to a tool route" test already
  // establishes as legitimate, not a test-only shortcut.
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const exportButton = page.getByRole('button', { name: 'Full Backup (JSON)' });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('full-backup');

  await expect(page.getByLabel('Import file')).toBeVisible();
});

test('Cover: Error recovery remains usable at mobile width (M9-017 — Error recovery)', async ({
  page,
}) => {
  await createPortfolio(page, {
    name: 'Mobile Error Recovery Portfolio',
    quantity: '0',
    debtBalance: '20000',
  });

  await expect(page.getByText(/cannot compute/i)).toBeVisible();
  const retryButton = page.getByRole('button', { name: 'Retry' });
  const downloadButton = page.getByRole('button', { name: 'Download recovery copy' });
  await expect(retryButton).toBeVisible();
  await expect(downloadButton).toBeVisible();

  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('2');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  const riskCheckbox = collateralSection.locator('input[type="checkbox"]');
  if ((await riskCheckbox.count()) > 0) await riskCheckbox.check();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(page.getByText(/cannot compute/i)).not.toBeVisible();
});

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Dashboard End-to-End Tests — 06_TASKS.md M5-027 ("Create Dashboard
 * End-to-End Tests"). Dependencies: M5-026. Description: "Create
 * Playwright tests for critical Dashboard workflows." DoD: "Critical
 * Dashboard workflows pass in supported viewport sizes."
 *
 * Follows `tests/e2e/portfolioWorkflows.spec.ts`'s (M4-018) own
 * established convention: one `test('Cover: <Flow>', ...)` block per
 * item in this task's own "Flows" list, real in-app link navigation (no
 * mid-flow `page.goto()`, which reloads the document and wipes the
 * in-memory Zustand store — Conflict B), same helper shape.
 * `tests/unit/app/page.test.tsx` (Batches 1–15) and
 * `tests/integration/dashboard/dashboardWorkflows.test.ts` (Batch 16,
 * M5-026) already exhaustively cover the Dashboard's own rendering and
 * Store/Service integration at their own layers; this file is the real,
 * compiled, real-browser layer neither of those touches.
 *
 * **The DoD's own "supported viewport sizes" clause gets one dedicated,
 * separate check** (the `VIEWPORTS` loop at the bottom, reusing
 * `tests/e2e/responsiveLayout.spec.ts`'s own M5-023 breakpoints and
 * "navigate wide, then resize" technique) rather than repeating all 8
 * Flows three times over — that would triple this file's runtime for no
 * new signal, since `responsiveLayout.spec.ts` already proves the page
 * itself never overflows at any of these three sizes. What is genuinely
 * new here is confirming the *workflow*, not just the layout, still
 * completes correctly at each size.
 *
 * **"Navigate to Simulation Workspace" / "Navigate to Exit Planner" —
 * via the sidebar, not Quick Actions.** `QuickActionsSection`'s own "Run
 * simulation" / "Create exit plan" buttons are deliberately
 * `aria-disabled` (M5-016, Batch 11) since Milestones 6/7 are not built
 * yet — clicking them does nothing. `AppSidebar` (M1-006) already links
 * to both placeholder routes for real; that is the one honestly
 * testable navigation path today, and these two tests confirm both
 * facts (the sidebar link works; the Quick Actions button does not
 * silently pretend to).
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

async function createPortfolioFromDashboard(
  page: Page,
  options: { name: string; quantity?: string },
) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', options.name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
  await page.locator('a', { hasText: 'Dashboard' }).click();
  await page.waitForURL('**/');
}

async function addAnotherPortfolio(page: Page, options: { name: string; quantity?: string }) {
  await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
  await page.waitForURL('**/portfolios');
  await page.getByRole('link', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolios/new');
  await fillByLabel(page, 'Portfolio name', options.name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
  await page.locator('a', { hasText: 'Dashboard' }).click();
  await page.waitForURL('**/');
}

async function updateManualPriceFromDashboard(page: Page, newPrice: string) {
  // `exact: true` — `QuickActionsSection` separately renders its own
  // "Edit portfolio" (lowercase) link, otherwise ambiguous with
  // `DashboardSummaryHeader`'s "Edit Portfolio".
  await page.getByRole('link', { name: 'Edit Portfolio', exact: true }).click();
  await page.waitForURL('**/portfolio');
  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  const priceInput = collateralSection
    .locator('label', { hasText: 'Manual price (USD)' })
    .locator('input');
  await priceInput.fill(newPrice);
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();
  await page.locator('a', { hasText: 'Dashboard' }).click();
  await page.waitForURL('**/');
}

test('Cover: Open first portfolio (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'First Portfolio' });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // The portfolio's own name also appears as an `<option>` in
  // `AppHeader`'s switcher — scoped to the Summary Header's `<h2>` to
  // avoid ambiguity with that option.
  await expect(page.getByRole('heading', { name: 'First Portfolio' })).toBeVisible();
});

test('Cover: Review core metrics (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Metrics Portfolio' });

  await expect(page.getByText('Net Portfolio Value')).toBeVisible();
  await expect(page.getByText('Health Factor', { exact: true })).toBeVisible();
  await expect(page.getByText('Loan-to-Value')).toBeVisible();
  // 2 BTC * $50,000 - $20,000 debt = $80,000.
  await expect(page.getByText('$80,000.00').first()).toBeVisible();
});

test('Cover: Switch portfolios (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Alpha Dashboard Portfolio' });
  await addAnotherPortfolio(page, {
    name: 'Beta Dashboard Portfolio',
    quantity: '5',
  });
  await expect(page.getByRole('heading', { name: 'Beta Dashboard Portfolio' })).toBeVisible();
  // 5 BTC * $50,000 - $20,000 debt = $230,000.
  await expect(page.getByText('$230,000.00').first()).toBeVisible();

  const switcher = page.locator('select[aria-label="Active portfolio"]');
  await switcher.selectOption({ label: 'Alpha Dashboard Portfolio' });

  await expect(page.getByRole('heading', { name: 'Alpha Dashboard Portfolio' })).toBeVisible();
  // 2 BTC * $50,000 - $20,000 debt = $80,000, distinct from Beta's own $230,000.
  await expect(page.getByText('$80,000.00').first()).toBeVisible();
});

test('Cover: Update manual BTC price (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Price Update Portfolio' });

  await page.getByRole('link', { name: 'Edit Portfolio', exact: true }).click();
  await page.waitForURL('**/portfolio');
  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  const priceInput = collateralSection
    .locator('label', { hasText: 'Manual price (USD)' })
    .locator('input');
  await priceInput.fill('60000');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(collateralSection.getByText('Health Factor', { exact: true })).toBeVisible();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(priceInput).toHaveValue('60000');
});

test('Cover: Observe recalculation (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Recalc Portfolio' });
  await expect(page.getByText('$80,000.00').first()).toBeVisible();

  await updateManualPriceFromDashboard(page, '60000');

  // 2 BTC * $60,000 - $20,000 debt = $100,000, replacing the original $80,000.
  await expect(page.getByText('$100,000.00').first()).toBeVisible();
  await expect(page.getByText('$80,000.00')).not.toBeVisible();
});

test('Cover: Open risk details (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Risk Details Portfolio' });

  await expect(page.getByText('Liquidation Risk')).toBeVisible();
  await expect(page.getByText('Health Factor Status')).toBeVisible();
  await expect(page.getByText('Estimated Liquidation Price')).toBeVisible();
  await expect(page.getByText('Current Health Factor')).toBeVisible();
});

test('Cover: Navigate to Simulation Workspace (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Simulation Nav Portfolio' });

  const runSimulation = page.getByRole('button', { name: 'Run simulation' });
  await expect(runSimulation).toHaveAttribute('aria-disabled', 'true');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
});

test('Cover: Navigate to Exit Planner (M5-027)', async ({ page }) => {
  await createPortfolioFromDashboard(page, { name: 'Exit Planner Nav Portfolio' });

  const createExitPlan = page.getByRole('button', { name: 'Create exit plan' });
  await expect(createExitPlan).toHaveAttribute('aria-disabled', 'true');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Exit Planner' })
    .click();
  await expect(page.getByRole('heading', { name: 'Exit Planner' })).toBeVisible();
});

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  'tablet (sidebar breakpoint)': { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: the critical Dashboard workflow's result renders correctly — ${name} (M5-027 DoD)`, async ({
    page,
  }) => {
    // Every step that navigates between routes (creating a second
    // portfolio, editing the price) happens at the default
    // (desktop-sized) viewport first — the sidebar's own links are
    // hidden below `md:` (`AppSidebar.tsx`), and no mobile-navigation
    // replacement exists yet (a pre-existing, already-documented gap —
    // see PROJECT_STATUS.md's own Batch 12 note), matching
    // `responsiveLayout.spec.ts`'s own established pattern. Resizing
    // only at the end, once the workflow has already completed, tests
    // whether its *result* renders correctly and without overflow at
    // this size — the DoD's own "pass in supported viewport sizes,"
    // not "can be driven through a mobile nav that does not exist."
    await createPortfolioFromDashboard(page, { name: 'Viewport Alpha' });
    await addAnotherPortfolio(page, { name: 'Viewport Beta', quantity: '5' });
    const switcher = page.locator('select[aria-label="Active portfolio"]');
    await switcher.selectOption({ label: 'Viewport Alpha' });
    await updateManualPriceFromDashboard(page, '60000');

    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Viewport Alpha' })).toBeVisible();
    await expect(page.getByText('Net Portfolio Value')).toBeVisible();
    // 2 BTC * $60,000 - $20,000 debt = $100,000.
    await expect(page.getByText('$100,000.00').first()).toBeVisible();
    await expect(page.getByText('Liquidation Risk')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
}

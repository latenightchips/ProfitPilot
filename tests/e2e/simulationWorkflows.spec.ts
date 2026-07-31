import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Simulation Workspace End-to-End Tests — 06_TASKS.md M6-025 ("Create
 * End-to-End Tests"). Dependencies: M6-024. Description: "Create
 * Playwright tests." Cover: "Open workspace, Create simulation, Modify
 * assumptions, Compare scenarios, Save, Reload, Export." DoD: "Critical
 * Simulation Workspace workflows pass successfully."
 *
 * Follows `tests/e2e/dashboardWorkflows.spec.ts`'s (M5-027) own
 * established convention: one `test('Cover: <item>', ...)` block per
 * item in this task's own "Cover" list, real in-app link navigation (no
 * mid-flow `page.goto()`, which reloads the document and wipes the
 * in-memory Zustand store — Conflict B), the same
 * `fillByLabel`/portfolio-creation helper shape.
 * `tests/unit/stores/simulationStore.test.ts` (Batches 1–22) and
 * `tests/integration/simulation/simulationWorkflows.test.ts` (Batch 23,
 * M6-024) already exhaustively cover the Simulation Store's own
 * behavior and Store-to-Store integration; this file is the real,
 * compiled, real-browser layer neither of those touches.
 *
 * **Unlike M5-027, M6-025's own DoD names no "supported viewport
 * sizes" clause** — its wording is simply "Critical Simulation
 * Workspace workflows pass successfully." `tests/e2e/responsiveLayout.spec.ts`
 * (Batch 20, M6-021) already separately proves the Simulation
 * Workspace itself never overflows at any of the three supported
 * widths; this file does not repeat that dedicated viewport loop, the
 * same "no new signal, don't triple the runtime" reasoning
 * `dashboardWorkflows.spec.ts`'s own header comment already applied.
 *
 * **"Reload" does not assert the Scenario Builder's own input fields
 * repopulate** — `ScenarioComparison.tsx`'s own header comment already
 * documents this as a known, deliberate limitation (Load restores the
 * displayed *result*, never resyncs the form's local `values` state).
 * This test instead confirms what Load actually does: the Simulation
 * Results/Assumptions panels show the original saved figures again,
 * not the diverged scenario's own numbers.
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

async function createPortfolioAndOpenSimulation(page: Page, name: string) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
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

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await page.waitForURL('**/simulation');
}

async function saveScenario(page: Page, btcPriceUsd: number, name: string) {
  await fillByLabel(page, 'BTC Price', String(btcPriceUsd));
  await page.waitForTimeout(150);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save Scenario' }).click();
  await page.waitForTimeout(150);
}

test('Cover: Open workspace (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Open Workspace Portfolio');

  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Scenario Controls' })).toBeVisible();
});

test('Cover: Create simulation (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Create Simulation Portfolio');

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);

  // 2 BTC * $65,000 − $20,000 debt = $110,000.
  await expect(page.getByText('$110,000.00')).toBeVisible();
});

test('Cover: Modify assumptions (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Modify Assumptions Portfolio');

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(150);
  await expect(page.getByText('Rate Assumptions')).not.toBeVisible();

  await fillByLabel(page, 'Borrow Rate (0–1)', '0.15');
  await page.waitForTimeout(200);

  await expect(page.getByText('Rate Assumptions')).toBeVisible();
  await expect(page.getByText('15.00% over 30 days')).toBeVisible();
});

test('Cover: Compare scenarios (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Compare Scenarios Portfolio');

  await saveScenario(page, 60000, 'Scenario Alpha');
  await saveScenario(page, 70000, 'Scenario Bravo');

  const checkboxes = page.getByRole('checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();

  await expect(page.getByRole('columnheader', { name: 'Scenario Alpha' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Scenario Bravo' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$100,000.00' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$120,000.00' })).toBeVisible();
});

test('Cover: Save (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Save Portfolio');

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('My Saved Scenario');
  await page.getByRole('button', { name: 'Save Scenario' }).click();

  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByText(/My Saved Scenario \(Price Scenario\)/)).toBeVisible();
});

test('Cover: Reload (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Reload Portfolio');

  await saveScenario(page, 65000, 'Original Scenario');
  // 2 BTC * $65,000 − $20,000 debt = $110,000.
  await expect(page.getByText('$110,000.00')).toBeVisible();

  // The user keeps working — a real, later, unrelated scenario change.
  await fillByLabel(page, 'BTC Price', '30000');
  await page.waitForTimeout(200);
  // `.first()` — "Portfolio Value" renders before "Profit/Loss" in
  // `ScenarioSummary.tsx`'s own `METRIC_ORDER`, and a diverged loss
  // scenario's own "-$40,000.00" Profit/Loss figure would otherwise
  // also match this same substring.
  await expect(page.getByText('$40,000.00').first()).toBeVisible();
  await expect(page.getByText('$110,000.00')).not.toBeVisible();

  await page.getByRole('button', { name: 'Load' }).click();

  // The original saved result is restored, not the diverged $40,000 one.
  await expect(page.getByText('$110,000.00')).toBeVisible();
  await expect(page.getByText('$40,000.00')).not.toBeVisible();
});

test('Cover: Export (M6-025)', async ({ page }) => {
  await createPortfolioAndOpenSimulation(page, 'Export Portfolio');

  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('simulation-export-price.json');
});

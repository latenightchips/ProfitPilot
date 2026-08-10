import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Exit Planner End-to-End Tests — 06_TASKS.md M7-042 ("Create Exit
 * Planner Tests"). Dependencies: M7-030. Description: "Test Exit
 * Planner components, state, and workflows." Cover: "Full exit, Partial
 * exit, Target Health Factor, Target retained BTC, Infeasible target,
 * Price sensitivity, Save and reload, Export." DoD: "Critical Exit
 * Planner behavior is covered by unit, integration, and end-to-end
 * tests."
 *
 * Follows `tests/e2e/loopBuilderWorkflows.spec.ts`'s (M7-041, this same
 * batch) own convention, itself mirroring `tests/e2e/simulationWorkflows.spec.ts`
 * (M6-025). `tests/unit/stores/exitPlannerStore.test.ts` and every
 * component's own `tests/unit/features/exit-planner/*.test.tsx` already
 * exhaustively cover the Store's own behavior and each component's own
 * rendering in isolation; this file is the real, compiled, real-browser
 * layer neither of those touches.
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

async function createPortfolioAndOpenExitPlanner(page: Page, name: string) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', name);
  await fillByLabel(page, 'BTC quantity', '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (%)', '75');
  await fillByLabel(page, 'Liquidation threshold (%)', '80');
  await fillByLabel(page, 'Borrow APR (%)', '5');
  await fillByLabel(page, 'Supply APR (%)', '2');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Exit Planner' })
    .click();
  await page.waitForURL('**/exit-planner');
}

test('Cover: Full exit (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Full Exit Portfolio');

  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);

  await expect(page.getByRole('heading', { name: 'Full Exit Result' })).toBeVisible();
  await expect(page.getByText('Feasible')).toBeVisible();
});

test('Cover: Partial exit (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Partial Exit Portfolio');

  await page.getByRole('button', { name: 'Partial Debt Repayment' }).click();
  await fillByLabel(page, 'Debt Repayment Amount (USD)', '10000');
  await page.waitForTimeout(300);

  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).toBeVisible();
});

test('Cover: Target Health Factor (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Target HF Portfolio');

  await page.getByRole('button', { name: 'Target Health Factor', exact: true }).click();
  // Target HF 8 → target debt = (100,000 * 0.8) / 8 = $10,000 < the
  // current $20,000 debt, so real repayment is genuinely needed (a
  // target HF at or below 4 here would already be satisfied without
  // selling anything and would resolve as infeasible instead).
  await fillByLabel(page, 'Target Health Factor', '8');
  await page.waitForTimeout(300);

  await expect(page.getByRole('heading', { name: 'Target Health Factor Detail' })).toBeVisible();
});

test('Cover: Target retained BTC (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Target Retained BTC Portfolio');

  await page.getByRole('button', { name: 'Target Retained BTC' }).click();
  await fillByLabel(page, 'BTC Quantity to Retain', '1');
  await page.waitForTimeout(300);

  const feasibleRows = page.getByText('Feasible');
  await expect(feasibleRows.first()).toBeVisible();
});

test('Cover: Infeasible target (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Infeasible Target Portfolio');

  // A repayment amount larger than the entire current debt resolves to
  // a negative target debt balance — genuinely infeasible, not a
  // hand-crafted case.
  await page.getByRole('button', { name: 'Partial Debt Repayment' }).click();
  await fillByLabel(page, 'Debt Repayment Amount (USD)', '999999');
  await page.waitForTimeout(300);

  await expect(page.getByText('This target is not feasible — see Warnings below.')).toBeVisible();
  await expect(
    page
      .getByText(
        'Reduce the requested repayment amount so it no longer exceeds the current debt balance.',
      )
      .first(),
  ).toBeVisible();
});

test('Cover: Price sensitivity (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Price Sensitivity Portfolio');

  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Run Price Sensitivity' }).click();
  await page.waitForTimeout(300);

  const table = page.getByRole('table', { name: 'Exit price sensitivity' });
  await expect(table).toBeVisible();
  await expect(table.getByText('Current Price')).toBeVisible();
  await expect(table.getByText('Lower-Price Case (-20%)')).toBeVisible();
  await expect(table.getByText('Higher-Price Case (+20%)')).toBeVisible();
});

test('Cover: Save and reload (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Save Reload Portfolio');

  await page.getByRole('button', { name: 'Partial Debt Repayment' }).click();
  await fillByLabel(page, 'Debt Repayment Amount (USD)', '10000');
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).toBeVisible();

  await page.locator('label', { hasText: 'Name' }).locator('input').fill('My Saved Exit Plan');
  await page.getByRole('button', { name: 'Save Plan' }).click();
  await expect(page.getByText(/My Saved Exit Plan — /)).toBeVisible();

  // The user keeps working — a real, later, unrelated target change.
  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  await expect(page.getByRole('heading', { name: 'Full Exit Result' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Load' }).click();
  await page.waitForTimeout(200);

  // The original saved Partial Exit result is restored, not the
  // diverged Full Exit one.
  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Full Exit Result' })).not.toBeVisible();
});

test('Cover: Export (M7-042)', async ({ page }) => {
  await createPortfolioAndOpenExitPlanner(page, 'Export Portfolio');

  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('exit-plan-export.json');
});

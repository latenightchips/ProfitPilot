import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Loop Builder End-to-End Tests — 06_TASKS.md M7-041 ("Create Loop
 * Builder Tests"). Dependencies: M7-018. Description: "Test Loop
 * Builder components, state, and workflows." Cover: "Valid strategy,
 * Unsafe strategy, Borrowing-capacity limit, Minimum Health Factor
 * stop, Cost calculations, Stress scenario, Save and reload, Export."
 * DoD: "Critical Loop Builder behavior is covered by unit, integration,
 * and end-to-end tests."
 *
 * Follows `tests/e2e/simulationWorkflows.spec.ts`'s (M6-025) own
 * established convention: one `test('Cover: <item>', ...)` block per
 * item in this task's own "Cover" list, real in-app link navigation, the
 * same `fillByLabel`/portfolio-creation helper shape. `tests/unit/stores/loopBuilderStore.test.ts`
 * (Milestone 7 Batches 2–3, extended this batch) and every component's
 * own `tests/unit/features/loop-builder/*.test.tsx` already exhaustively
 * cover the Store's own behavior and each component's own rendering in
 * isolation; this file is the real, compiled, real-browser layer neither
 * of those touches, the same division of labor `simulationWorkflows.spec.ts`'s
 * own header comment already establishes for Simulation.
 *
 * **"Borrowing-capacity limit" needs a starting position at its own
 * borrow ceiling, not the shared default portfolio** — `BORROWING_CAPACITY`
 * (`validateLoopStrategySafety.ts`) fires when Available Borrow (F-013)
 * on the *starting* position is already `<= 0`: 2 BTC @ $50,000 = a
 * $100,000 starting collateral value, and a 0.75 max LTV, put that
 * ceiling at exactly $75,000 of debt — this file's own
 * `createPortfolioAndOpenLoopBuilder` helper accepts a `debtBalance`
 * override for exactly this test.
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

async function createPortfolioAndOpenLoopBuilder(
  page: Page,
  name: string,
  options: { debtBalance?: string } = {},
) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', name);
  await fillByLabel(page, 'BTC quantity', '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', options.debtBalance ?? '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Loop Builder' })
    .click();
  await page.waitForURL('**/loop-builder');
}

test('Cover: Valid strategy (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Valid Strategy Portfolio');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);

  const steps = page.getByRole('table', { name: 'Loop strategy steps' });
  await expect(steps).toBeVisible();
  expect(await steps.locator('tbody tr').count()).toBeGreaterThan(0);
});

test('Cover: Unsafe strategy (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Unsafe Strategy Portfolio');

  // A configured floor at the liquidation boundary is itself unsafe
  // (MINIMUM_HEALTH_FACTOR) — a real config-time safety-check failure,
  // not the strategy running out of room mid-loop (that is the separate
  // "Minimum Health Factor stop" scenario below).
  await fillByLabel(page, 'Minimum Health Factor', '1');
  await page.waitForTimeout(300);

  await expect(page.getByText('Safety check "MINIMUM_HEALTH_FACTOR" failed.')).toBeVisible();
  await expect(
    page.getByText('Configure a viable strategy to see its individual steps.'),
  ).toBeVisible();
});

test('Cover: Borrowing-capacity limit (M7-041)', async ({ page }) => {
  // Debt already at the starting position's own borrow ceiling
  // (2 BTC @ $50,000 * 0.75 max LTV = $75,000) — a real
  // BORROWING_CAPACITY warning, not a hand-crafted one.
  await createPortfolioAndOpenLoopBuilder(page, 'Borrowing Capacity Portfolio', {
    debtBalance: '75000',
  });

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);

  await expect(page.getByText('Safety check "BORROWING_CAPACITY" raised a warning.')).toBeVisible();
  await expect(page.getByText('No further borrowing capacity available').first()).toBeVisible();
});

test('Cover: Minimum Health Factor stop (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Min HF Stop Portfolio');

  // A real, valid safety floor (well above 1.0) high enough that the
  // loop's own iterative algorithm stops before exhausting either
  // borrowing capacity or the configured loop count.
  await fillByLabel(page, 'Minimum Health Factor', '3');
  await fillByLabel(page, 'Maximum Number of Loops', '10');
  await page.waitForTimeout(300);

  await expect(page.getByText('Minimum Health Factor reached').first()).toBeVisible();
});

test('Cover: Cost calculations (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Cost Calculations Portfolio');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);

  await expect(page.getByText('Effective Leverage Achieved')).toBeVisible();
  await expect(page.getByText('Total (Annual) Interest Cost')).toBeVisible();
  await expect(page.getByText('Break-Even BTC Appreciation Needed')).toBeVisible();
});

test('Cover: Stress scenario (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Stress Scenario Portfolio');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'BTC Price Decline (-25%)' }).click();
  await page.waitForTimeout(300);

  await expect(page.getByRole('table', { name: 'Loop scenario sensitivity' })).toBeVisible();
  await expect(page.getByText('Under Stress')).toBeVisible();
});

test('Cover: Save and reload (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Save Reload Portfolio');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);
  const originalStepCount = await page
    .getByRole('table', { name: 'Loop strategy steps' })
    .locator('tbody tr')
    .count();

  await page.locator('label', { hasText: 'Name' }).locator('input').fill('My Saved Strategy');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect(page.getByText(/My Saved Strategy — /)).toBeVisible();

  // The user keeps working — a real, later, unrelated settings change.
  await fillByLabel(page, 'Borrow Percentage Per Step', '0.2');
  await page.waitForTimeout(300);
  const divergedStepCount = await page
    .getByRole('table', { name: 'Loop strategy steps' })
    .locator('tbody tr')
    .count();
  expect(divergedStepCount).not.toBe(originalStepCount);

  await page.getByRole('button', { name: 'Load' }).click();
  await page.waitForTimeout(200);

  const reloadedStepCount = await page
    .getByRole('table', { name: 'Loop strategy steps' })
    .locator('tbody tr')
    .count();
  expect(reloadedStepCount).toBe(originalStepCount);
});

test('Cover: Export (M7-041)', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'Export Portfolio');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('loop-strategy-export.json');
});

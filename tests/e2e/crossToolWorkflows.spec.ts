import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Cross-Tool Workflow End-to-End Tests — 06_TASKS.md M7-044 ("Create
 * Cross-Tool Workflow Tests"). Dependencies: M7-041, M7-042, M7-043.
 * Description: "Create Playwright tests covering connected strategy
 * workflows." Flows: "Open a Dashboard recommendation and create an
 * exit plan, Build a loop and stress-test it in Simulation Workspace,
 * Copy an exit plan into a simulation, Switch portfolios and verify
 * strategy isolation, Reload a saved strategy." DoD: "Data and
 * assumptions transfer correctly without modifying live portfolios."
 *
 * **"Copy an exit plan into a simulation" had no underlying feature to
 * test — a real gap found while planning this file, not assumed.**
 * Exit Planner never got an equivalent to Loop Builder's own
 * `ApplyLoopAsSimulation.tsx` (M7-016) anywhere in M7-019 through
 * M7-030. `features/exit-planner/components/ApplyExitPlanAsSimulation.tsx`
 * (added this same batch) is the minimal, justified bridge needed to
 * make this flow real — see that component's own header comment for
 * the full reasoning (reuses the exact same `PortfolioActionSimulationInput`
 * mechanism Loop Builder's own bridge already established).
 *
 * **"Without modifying live portfolios" is verified directly, not
 * assumed** — every flow below re-visits `/portfolio` afterward and
 * confirms the original collateral/debt figures are still exactly what
 * they were before any strategy action ran.
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

async function createPortfolio(
  page: Page,
  name: string,
  options: {
    quantity?: string;
    debtBalance?: string;
    targetHealthFactor?: string;
  } = {},
) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', options.debtBalance ?? '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  if (options.targetHealthFactor !== undefined) {
    await fillByLabel(page, 'Target Health Factor', options.targetHealthFactor);
  }
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
}

/**
 * Creates a second portfolio mid-flow without a hard `page.goto`
 * navigation, which would wipe every in-memory Zustand store (Conflict
 * B) — including whatever the flow just built in `loopBuilderStore`/
 * `exitPlannerStore`. Reaches `/portfolios/new` via real in-app links
 * instead ("Manage portfolios" in `AppHeader.tsx`, then "Create
 * Portfolio" on `/portfolios`), the same client-side-navigation
 * discipline every other helper in this file already follows.
 */
async function createPortfolioMidFlow(
  page: Page,
  name: string,
  options: { quantity?: string; debtBalance?: string } = {},
) {
  await page.getByRole('link', { name: 'Manage portfolios' }).click();
  await page.waitForURL('**/portfolios');
  await page.getByRole('link', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolios/new');

  await fillByLabel(page, 'Portfolio name', name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', options.debtBalance ?? '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
}

async function goTo(page: Page, linkName: string, url: string) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: linkName, exact: true })
    .click();
  await page.waitForURL(url);
}

async function expectUnchangedPortfolio(page: Page, quantity: string, debtBalance: string) {
  await goTo(page, 'Portfolio', '**/portfolio');
  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  await expect(
    collateralSection.locator('label', { hasText: 'Quantity' }).locator('input'),
  ).toHaveValue(quantity);
  const debtSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Debt' }) });
  await expect(
    debtSection.locator('label', { hasText: 'Debt amount' }).locator('input'),
  ).toHaveValue(debtBalance);
}

test('Flow: Open a Dashboard recommendation and create an exit plan (M7-044)', async ({ page }) => {
  await createPortfolio(page, 'Cross-Tool Dashboard Flow Portfolio', { targetHealthFactor: '8' });
  await goTo(page, 'Dashboard', '**/');

  // The same repayment recommendation the Dashboard's own summary
  // widget shows is what the full Recommendation Center exposes with a
  // real action link — Dashboard's own summary has no action link of
  // its own (deliberately, see `RecommendationSummarySection.tsx`'s own
  // header comment), so this flow continues through the Recommendation
  // Center, the one place that link genuinely lives.
  await expect(page.getByText(/Current debt exceeds/)).toBeVisible();

  await goTo(page, 'Recommendations', '**/recommendations');
  await page.getByText('Current debt exceeds the target debt required').click();
  await page.getByRole('button', { name: 'Open Exit Planner with this target' }).click();
  await page.waitForURL('**/exit-planner');

  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).toBeVisible();
  await expectUnchangedPortfolio(page, '2', '20000');
});

test('Flow: Build a loop and stress-test it in Simulation Workspace (M7-044)', async ({ page }) => {
  await createPortfolio(page, 'Cross-Tool Loop Simulation Flow Portfolio');
  await goTo(page, 'Loop Builder', '**/loop-builder');

  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Apply Loop as Simulation' }).click();
  await page.waitForTimeout(200);

  await goTo(page, 'Simulation', '**/simulation');
  await expect(page.getByText('Portfolio Action')).toBeVisible();

  // Stress-test on top of the applied loop with a real price scenario.
  await fillByLabel(page, 'BTC Price', '30000');
  await page.waitForTimeout(200);
  await expect(page.getByText('Portfolio Action')).toBeVisible();
  await expect(page.getByText('Portfolio Value').first()).toBeVisible();

  await expectUnchangedPortfolio(page, '2', '20000');
});

test('Flow: Copy an exit plan into a simulation (M7-044)', async ({ page }) => {
  await createPortfolio(page, 'Cross-Tool Exit Simulation Flow Portfolio');
  await goTo(page, 'Exit Planner', '**/exit-planner');

  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  await expect(page.getByRole('heading', { name: 'Full Exit Result' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply Exit Plan as Simulation' }).click();
  await page.waitForTimeout(200);

  await goTo(page, 'Simulation', '**/simulation');
  await expect(page.getByText('Portfolio Action')).toBeVisible();
  // A full exit repays the entire $20,000 debt — Debt after is $0.
  await expect(page.getByText('$0.00').first()).toBeVisible();

  await expectUnchangedPortfolio(page, '2', '20000');
});

test('Flow: Switch portfolios and verify strategy isolation (M7-044)', async ({ page }) => {
  await createPortfolio(page, 'Cross-Tool Isolation Portfolio A');
  await goTo(page, 'Loop Builder', '**/loop-builder');
  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);
  await page.locator('label', { hasText: 'Name' }).locator('input').fill('Strategy A');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect(page.getByText(/Strategy A — /)).toBeVisible();

  // A second, independent portfolio — creating it makes it active. Via
  // in-app links, not `page.goto`, so `loopBuilderStore`'s own
  // `savedStrategies` (just populated above) survives the navigation.
  await createPortfolioMidFlow(page, 'Cross-Tool Isolation Portfolio B', {
    quantity: '5',
    debtBalance: '10000',
  });
  await goTo(page, 'Loop Builder', '**/loop-builder');

  // Strategy A is still listed (saved strategies are not portfolio-
  // scoped away), but honestly flagged as belonging to a different
  // portfolio — never silently treated as Portfolio B's own.
  await expect(page.getByText(/Strategy A — /)).toBeVisible();
  await expect(page.getByText('Saved against a different portfolio.')).toBeVisible();

  // Portfolio A's own real data was never touched by any of this.
  await page
    .getByLabel('Active portfolio')
    .selectOption({ label: 'Cross-Tool Isolation Portfolio A' });
  await expectUnchangedPortfolio(page, '2', '20000');
});

test('Flow: Reload a saved strategy (M7-044)', async ({ page }) => {
  await createPortfolio(page, 'Cross-Tool Reload Flow Portfolio');
  await goTo(page, 'Loop Builder', '**/loop-builder');
  await fillByLabel(page, 'Borrow Percentage Per Step', '0.6');
  await page.waitForTimeout(300);
  const savedStepCount = await page
    .getByRole('table', { name: 'Loop strategy steps' })
    .locator('tbody tr')
    .count();

  await page.locator('label', { hasText: 'Name' }).locator('input').fill('Reload Flow Strategy');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect(page.getByText(/Reload Flow Strategy — /)).toBeVisible();

  // Navigate away entirely — a full route change, not just an
  // in-place divergence — then come back and reload.
  await goTo(page, 'Dashboard', '**/');
  await goTo(page, 'Loop Builder', '**/loop-builder');
  await expect(page.getByText(/Reload Flow Strategy — /)).toBeVisible();

  await page.getByRole('button', { name: 'Load' }).click();
  await page.waitForTimeout(200);

  const reloadedStepCount = await page
    .getByRole('table', { name: 'Loop strategy steps' })
    .locator('tbody tr')
    .count();
  expect(reloadedStepCount).toBe(savedStepCount);

  await expectUnchangedPortfolio(page, '2', '20000');
});

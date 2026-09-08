import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Recommendation Center End-to-End Tests — 06_TASKS.md M7-043 ("Create
 * Recommendation Center Tests"). Dependencies: M7-036. Description:
 * "Test recommendation behavior." Cover: "Priority ordering, Category
 * filters, Trigger explanations, Action links, Portfolio recalculation,
 * Critical warning persistence." DoD: "Recommendations remain
 * deterministic and traceable in automated tests."
 *
 * Follows `tests/e2e/loopBuilderWorkflows.spec.ts`'s (M7-041, this same
 * batch) own convention. `tests/unit/stores/recommendationCenterStore.test.ts`
 * and every component's own `tests/unit/features/recommendations/*.test.tsx`
 * already exhaustively cover the Store's own behavior (including this
 * exact "Priority ordering"/"Critical warning persistence" logic) and
 * each component's own rendering in isolation; this file is the real,
 * compiled, real-browser layer neither of those touches.
 *
 * **Fixture: 2 BTC @ $50,000, $20,000 debt, Target Health Factor 8** —
 * Target Collateral Value = (8 * 20,000)/0.8 = $200,000, well above the
 * real $100,000 collateral value, and Target Debt = (100,000 * 0.8)/8 =
 * $10,000, below the real $20,000 debt — both recommendations are
 * genuinely actionable (not "no action needed"), the same fixture
 * `tests/unit/stores/recommendationCenterStore.test.ts`'s own
 * `portfolioFixture` already establishes.
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

async function createPortfolioAndOpenRecommendations(page: Page, name: string) {
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
  await fillByLabel(page, 'Target Health Factor', '8');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Recommendations' })
    .click();
  await page.waitForURL('**/recommendations');
}

test('Cover: Priority ordering (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Priority Ordering Portfolio');

  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();
  const rows = page.getByRole('button', { name: /High · Maintain Target Health Factor/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Current debt exceeds');
  await expect(rows.nth(1)).toContainText('Current collateral is insufficient');
});

test('Cover: Category filters (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Category Filters Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

  await page.getByRole('button', { name: 'Debt', exact: true }).click();
  await expect(page.getByText(/Current debt exceeds/)).toBeVisible();
  await expect(page.getByText(/Current collateral is insufficient/)).not.toBeVisible();

  await page.getByRole('button', { name: 'Collateral', exact: true }).click();
  await expect(page.getByText(/Current collateral is insufficient/)).toBeVisible();
  await expect(page.getByText(/Current debt exceeds/)).not.toBeVisible();

  // A category this Recommendation Center genuinely never computes —
  // a real, traceable "not available" reason, not a blank filter result.
  await page.getByRole('button', { name: 'Safety', exact: true }).click();
  await expect(page.getByText('Not available for this category.')).toBeVisible();
});

test('Cover: Trigger explanations (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Trigger Explanations Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

  await page.getByText('Current debt exceeds the target debt required').click();
  const detailPanel = page.getByRole('region', { name: 'Recommendation Detail' });
  await expect(detailPanel.getByText('Triggering Condition')).toBeVisible();
  await expect(
    detailPanel.getByText(
      'Current debt exceeds the target debt required to reach the requested Health Factor.',
    ),
  ).toBeVisible();
  await expect(detailPanel.getByText('Current Values')).toBeVisible();
  await expect(detailPanel.getByText('Formula IDs')).toBeVisible();
  await expect(detailPanel.getByText('F-062', { exact: false })).toBeVisible();
});

test('Cover: Action links (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Action Links Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

  await page.getByText('Current debt exceeds the target debt required').click();
  await page.getByRole('button', { name: 'Open Exit Planner with this target' }).click();
  await page.waitForURL('**/exit-planner');

  // The recommendation's own $10,000 repayment prefilled the Exit
  // Planner and already produced a real result — without re-entering
  // any numbers.
  await expect(page.getByRole('heading', { name: 'Partial Exit Result' })).toBeVisible();
});

test('Cover: Portfolio recalculation (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Recalculation Portfolio');
  await expect(page.getByText('Repay 10000', { exact: false })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio', exact: true })
    .click();
  await page.waitForURL('**/portfolio');

  const debtSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Debt' }) });
  await debtSection.locator('label', { hasText: 'Debt amount' }).locator('input').fill('25000');
  await debtSection.getByRole('button', { name: 'Preview Changes' }).click();
  await page.waitForTimeout(200);
  // Raising debt lowers Health Factor — a real risk-increasing change
  // that requires the explicit acknowledgment checkbox before Apply
  // Changes enables (Conflict #26's own resolution).
  await debtSection.getByRole('checkbox').check();
  await debtSection.getByRole('button', { name: 'Apply Changes' }).click();
  await page.waitForTimeout(200);

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Recommendations' })
    .click();
  await page.waitForURL('**/recommendations');

  // Target debt is still $10,000, but current debt is now $25,000 —
  // a real, different, recalculated repayment figure.
  await expect(page.getByText('Repay 15000', { exact: false })).toBeVisible();
});

test('Cover: Critical warning persistence (M7-043)', async ({ page }) => {
  await createPortfolioAndOpenRecommendations(page, 'Warning Persistence Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

  const acknowledgeButtons = page.getByRole('button', { name: 'Acknowledge' });
  await acknowledgeButtons.first().click();

  // Acknowledged, but never hidden — still visible in its own section.
  await expect(page.getByRole('heading', { name: 'Acknowledged' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Un-acknowledge' })).toBeVisible();

  // A real, material change to the acknowledged recommendation's own
  // underlying numbers automatically returns it to the active groups —
  // an acknowledgement must not survive a genuine risk change.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio', exact: true })
    .click();
  await page.waitForURL('**/portfolio');

  const debtSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Debt' }) });
  await debtSection.locator('label', { hasText: 'Debt amount' }).locator('input').fill('25000');
  await debtSection.getByRole('button', { name: 'Preview Changes' }).click();
  await page.waitForTimeout(200);
  // Raising debt lowers Health Factor — a real risk-increasing change
  // that requires the explicit acknowledgment checkbox before Apply
  // Changes enables (Conflict #26's own resolution).
  await debtSection.getByRole('checkbox').check();
  await debtSection.getByRole('button', { name: 'Apply Changes' }).click();
  await page.waitForTimeout(200);

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Recommendations' })
    .click();
  await page.waitForURL('**/recommendations');

  await expect(page.getByRole('heading', { name: 'Acknowledged' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(2);
});

/**
 * v1.18.0 golden path — Batch 4 (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §15's own E2E requirement). Configure Recommendation Preferences on
 * Portfolio Details, confirm Borrow/Loop unlock in the Recommendation
 * Center with presented (not raw) copy and real traceability preserved
 * in the Detail Panel, then clear one field and confirm the
 * corresponding item re-locks with a real, sourced reason — the same
 * `2 BTC @ $50,000, $20,000 debt` fixture this file's own header comment
 * already establishes, so Repayment/Additional Collateral's real numbers
 * ($10,000/$100,000) stay directly comparable to this file's other
 * tests.
 */
test('Cover: v1.18.0 golden path — configure Recommendation Preferences, Borrow/Loop unlock with presented copy, clearing re-locks', async ({
  page,
}) => {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', 'v1.18.0 Golden Path Portfolio');
  await fillByLabel(page, 'BTC quantity', '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (%)', '75');
  await fillByLabel(page, 'Liquidation threshold (%)', '80');
  await fillByLabel(page, 'Borrow APR (%)', '5');
  await fillByLabel(page, 'Supply APR (%)', '2');
  await fillByLabel(page, 'Target Health Factor', '8');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');

  // Configure all four Recommendation Preferences fields.
  await fillByLabel(page, 'Minimum Health Factor for borrowing', '1.5');
  await fillByLabel(page, 'Target Debt Ratio ceiling', '0.5');
  await fillByLabel(page, 'Loop borrow percentage', '0.5');
  await fillByLabel(page, 'Maximum acceptable annual interest cost', '5000');
  // Autosave debounce (600ms) plus buffer.
  await page.waitForTimeout(900);

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Recommendations' })
    .click();
  await page.waitForURL('**/recommendations');

  // Borrow and Loop both now appear — real triggering conditions (raw
  // Engine text, unaltered — `presentationTextFor`'s own `headline`),
  // not a fabricated placeholder.
  await expect(
    page.getByText(/Health Factor.*borrow capacity.*Debt Ratio|Health Factor at or below minimum/),
  ).toBeVisible();

  // Detail Panel: presented copy, not the raw directive, is the primary
  // "Suggested Action" text — and the raw Engine string stays inspectable.
  await page
    .getByText(/Health Factor.*borrow capacity.*Debt Ratio|Health Factor at or below minimum/)
    .first()
    .click();
  const detailPanel = page.getByRole('region', { name: 'Recommendation Detail' });
  await expect(
    detailPanel.getByText(/your configured (minimum Health Factor|limits)/),
  ).toBeVisible();
  await expect(detailPanel.getByText(/Raw Engine output:/)).toBeVisible();
  await expect(detailPanel.getByText('F-061', { exact: false })).toBeVisible();

  // Clear Borrow's Target Debt Ratio field — Borrow's own pair is now
  // incomplete, so it re-locks; Loop (independent) is unaffected.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio', exact: true })
    .click();
  await page.waitForURL('**/portfolio');
  const debtRatioInput = page
    .locator('label', { hasText: 'Target Debt Ratio ceiling' })
    .locator('input');
  await debtRatioInput.fill('');
  await page.waitForTimeout(900);

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Recommendations' })
    .click();
  await page.waitForURL('**/recommendations');
  await page.getByRole('button', { name: 'Debt', exact: true }).click();
  await expect(page.getByText(/Configure your minimum Health Factor/)).toBeVisible();
});

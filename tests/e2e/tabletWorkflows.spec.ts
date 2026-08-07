import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Tablet Workflow Review End-to-End Tests — 06_TASKS.md M9-018
 * ("Complete Tablet Workflow Review"). Dependencies: M9-015. Description:
 * "Review supported tablet layouts." DoD: "Information hierarchy and
 * interaction remain stable between mobile and desktop breakpoints."
 *
 * **768px is materially different from mobile, not a smaller desktop —
 * confirmed by inspection, not assumed.** `AppSidebar.tsx` is `hidden
 * md:block`, and Tailwind's `md:` breakpoint is `min-width: 768px` — the
 * exact width `docs/QUALITY_PLAN.md` §4 already names "Tablet (sidebar
 * breakpoint)." So unlike `tests/e2e/mobileWorkflows.spec.ts` (M9-017,
 * 375px, no sidebar, Quick Actions is the only navigation surface),
 * tablet has the full sidebar and can navigate exactly like desktop —
 * the real "Review" question here is narrower: does that navigation and
 * the pages it reaches actually *work* right at this exact breakpoint
 * boundary, and does the Dashboard's own information hierarchy hold at
 * this width, not whether a mobile-style nav replacement is needed here
 * too (it is not — the sidebar is already present).
 *
 * **Lighter scope than M9-017 (P1/Effort M vs. P0/Effort XL, and this
 * task's own Dependencies list M9-015 only, not M9-016)** — a "Review,"
 * not a second full interactive suite. `tests/e2e/responsiveLayout.spec.ts`
 * already proves no page overflows at 768px on 5 routes; this file adds
 * the two things that check specifically: cross-tool sidebar navigation
 * genuinely working (not just rendering) at this width, and the
 * Dashboard's own documented section order (`PROJECT_STATUS.md`'s own
 * Batch 12 write-up: "Summary Header → Data Freshness → Quick Actions →
 * Risk Warnings/No-Debt Notice → KPI Grid → Health Factor Status →
 * Liquidation Risk → Portfolio Composition → Debt/Interest → Leverage →
 * Recommendations") holding unchanged at this width, not re-verified at
 * a third viewport for no new signal.
 */
const TABLET_VIEWPORT = { width: 768, height: 1024 };

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

async function createPortfolio(page: Page, name: string) {
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
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(TABLET_VIEWPORT);
});

test('Cover: Sidebar navigation between tools remains stable at the tablet breakpoint (M9-018)', async ({
  page,
}) => {
  await createPortfolio(page, 'Tablet Navigation Portfolio');

  const sidebar = page.getByRole('navigation', { name: 'Primary' });
  await expect(sidebar).toBeVisible();

  await sidebar.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Simulation' }).click();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Loop Builder' }).click();
  await expect(page.getByRole('heading', { name: 'Loop Builder' })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Exit Planner' }).click();
  await expect(page.getByRole('heading', { name: 'Exit Planner' })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Portfolio' }).click();
  await expect(page.getByLabel('Portfolio name')).toHaveValue('Tablet Navigation Portfolio');
});

test('Cover: Forms and scenario controls remain interactive at the tablet breakpoint (M9-018)', async ({
  page,
}) => {
  await createPortfolio(page, 'Tablet Forms Portfolio');

  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(collateralSection.getByText('Health Factor', { exact: true })).toBeVisible();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect(page.getByRole('complementary', { name: 'Scenario Controls' })).toBeVisible();
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  // 3 BTC * $65,000 − $20,000 debt = $175,000.
  await expect(page.getByText('$175,000.00')).toBeVisible();
});

test('Cover: Dashboard information hierarchy is unchanged from desktop at the tablet breakpoint (M9-018)', async ({
  page,
}) => {
  await createPortfolio(page, 'Tablet Hierarchy Portfolio');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const expectedOrder = [
    'Data Freshness',
    'Quick Actions',
    'Health Factor Status',
    'Liquidation Risk',
    'Portfolio Composition',
  ];
  const headingBoxes = await Promise.all(
    expectedOrder.map(async (text) => {
      const heading = page.getByRole('heading', { name: text });
      await expect(heading).toBeVisible();
      const box = await heading.boundingBox();
      if (box === null) throw new Error(`no bounding box for heading "${text}"`);
      return box.y;
    }),
  );

  // Each named section's own heading sits strictly below the previous
  // one, at this exact viewport width — the same top-to-bottom order
  // `PROJECT_STATUS.md`'s own Batch 12 write-up documents as unchanged
  // since Milestone 5 Batch 1, verified here specifically at 768px
  // rather than assumed to carry over from the desktop/mobile checks.
  for (let i = 1; i < headingBoxes.length; i++) {
    expect(headingBoxes[i]).toBeGreaterThan(headingBoxes[i - 1]);
  }
});

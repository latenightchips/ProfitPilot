import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Responsive Layout End-to-End Tests — 06_TASKS.md M5-023 ("Implement
 * Dashboard Responsive Layout") + M6-021 ("Responsive Workspace",
 * Milestone 6 Batch 20). M5-023 Requirement: "No horizontal page
 * scrolling." M5-023 DoD: "All Dashboard functionality remains usable
 * on mobile, tablet, and desktop." M6-021 Description: "Optimize
 * Simulation Workspace for desktop, tablet and mobile." M6-021 DoD:
 * "Simulation tools remain usable on supported screen sizes."
 *
 * A real-browser, real-viewport check is the only honest way to verify
 * "no horizontal page scrolling" — Vitest/Testing Library run in jsdom,
 * which does not compute real box layout, so this property cannot be
 * unit-tested. The Dashboard section of this file is the permanent
 * regression test for the two real overflow bugs Batch 12's own manual
 * audit found and fixed (`AppHeader`'s unconstrained `<select>`,
 * `PortfolioCompositionSection`'s cramped table at exactly the 768px
 * sidebar-appears breakpoint, and the `<main>` `min-w-0` fix in
 * `AppShell` that lets its own `overflow-x-auto` actually contain that
 * table instead of widening the page) — a name-only, viewport-width-only
 * reproduction of a bug that would not otherwise be exercised by any
 * per-component unit test.
 *
 * **The Simulation section below found zero equivalent bugs — a
 * documented negative result, not an omission.** Real-browser checks at
 * 375/768/1280px, with a long portfolio name (`AppHeader`'s own Batch 12
 * fix already covers every route, including this one) and a populated
 * Scenario Comparison table (3 saved scenarios selected), found no page-
 * level horizontal overflow anywhere. `app/simulation/page.tsx`'s own
 * `flex-col lg:flex-row` sidebar layout (real since M6-001, Batch 1),
 * `ScenarioComparison.tsx`'s own `overflow-x-auto` comparison-table
 * container (real since M6-010, Batch 9), and `ScenarioCharts.tsx`/
 * `ScenarioTimeline.tsx`'s own recharts `ResponsiveContainer` usage (real
 * since M6-011/M6-012, Batches 10–11) already independently satisfy
 * M6-021's own Description and DoD — this batch's job was to verify that
 * empirically, the same way Batch 12 verified the Dashboard, not to
 * invent a redundant second layout mechanism. No Simulation source file
 * was changed for M6-021; only these permanent regression tests were
 * added, mirroring the Dashboard section's own already-approved
 * structure and the "table needs its own scroll container at narrow
 * widths" pattern below.
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

async function createPortfolioViaDashboard(page: Page, name: string) {
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
  await page.locator('a', { hasText: 'Dashboard' }).click();
  await page.waitForURL('**/');
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  'tablet (sidebar breakpoint)': { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: no horizontal page scrolling on the Dashboard — ${name}`, async ({ page }) => {
    // Navigate at the default (desktop-sized) viewport first — the
    // sidebar's own "Dashboard" link is hidden below `md:` (`AppSidebar.tsx`),
    // and a `page.goto()` at a narrow viewport would need it. Resizing
    // *after* navigating preserves the in-memory Zustand store (Conflict
    // B) while still exercising the real breakpoint's actual layout.
    await createPortfolioViaDashboard(page, 'Responsive Layout Verification Portfolio');
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('Cover: Portfolio Composition table scrolls within its own container, not the page, at the sidebar breakpoint', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORTS['tablet (sidebar breakpoint)']);
  await createPortfolioViaDashboard(page, 'Table Scroll Check');

  // Dashboard hydration is now genuinely asynchronous (M8-008) — wait for
  // the Portfolio Composition table to actually be rendered before
  // measuring it, the same waiting discipline every sibling test in this
  // file already uses, rather than racing the mount effect's own
  // `load()`/`persistenceService` read.
  await expect(page.getByText('Portfolio %')).toBeVisible();

  const tableContainer = page.locator('table').locator('..');
  const scrollInfo = await tableContainer.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);

  await tableContainer.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expectNoHorizontalOverflow(page);
});

async function fillByLabelExact(page: Page, labelText: string, value: string) {
  await page.getByRole('textbox', { name: labelText, exact: true }).fill(value);
}

async function createPortfolioAndNavigateToSimulation(page: Page, name: string) {
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
  await page.locator('a', { hasText: 'Simulation' }).click();
  await page.waitForURL('**/simulation');
}

async function saveScenario(page: Page, btcPriceUsd: number, name: string) {
  await fillByLabel(page, 'BTC Price', String(btcPriceUsd));
  await page.waitForTimeout(150);
  await fillByLabelExact(page, 'Name', name);
  await page.getByRole('button', { name: 'Save Scenario' }).click();
  await page.waitForTimeout(150);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: no horizontal page scrolling on the Simulation Workspace — ${name}`, async ({
    page,
  }) => {
    // Same resize-after-navigate approach as the Dashboard tests above,
    // for the same reason (Conflict B: no persistence, and the sidebar's
    // own "Simulation" link is hidden below `md:`).
    await createPortfolioAndNavigateToSimulation(
      page,
      'A Reasonably Long Simulation Workspace Overflow Check Portfolio Name',
    );
    await saveScenario(page, 65000, 'Bull Case');
    // Populate Scenario Charts/Timeline (interest scenario) and the
    // Comparison table (3 saved scenarios, all selected) — the
    // heaviest real content this route renders.
    await fillByLabel(page, 'Borrow Rate (%)', '10');
    await page.waitForTimeout(150);
    await saveScenario(page, 60000, 'Bear Case');
    await saveScenario(page, 70000, 'Base Case');
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('Cover: Scenario Comparison table scrolls within its own container, not the page, at mobile width', async ({
  page,
}) => {
  await createPortfolioAndNavigateToSimulation(page, 'Simulation Table Scroll Check');
  await saveScenario(page, 60000, 'Scenario Alpha');
  await saveScenario(page, 70000, 'Scenario Bravo');
  await saveScenario(page, 80000, 'Scenario Charlie');
  const checkboxes = page.getByRole('checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();

  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(100);

  const tableContainer = page.locator('table').locator('..');
  const scrollInfo = await tableContainer.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);

  await tableContainer.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(page.getByRole('columnheader', { name: 'Scenario Charlie' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

/**
 * Loop Builder / Exit Planner / Recommendation Center — 06_TASKS.md
 * M7-039 ("Implement Responsive Strategy Layouts"). Requirements: "Step
 * tables adapt to small screens," "Forms remain usable without
 * horizontal scrolling." DoD: "All strategy workflows remain functional
 * on supported screen sizes." Same real-browser, real-viewport
 * discipline as the Dashboard/Simulation sections above — this is the
 * only honest way to verify "no horizontal page scrolling."
 *
 * A real, found-not-assumed bug this section's own manual verification
 * caught: the content column on both `app/loop-builder/page.tsx` and
 * `app/exit-planner/page.tsx` lacked `min-w-0`, so a wide table inside it
 * (`LoopStepTable.tsx`'s own `min-w-[640px]`) forced the whole page to
 * overflow horizontally at mobile widths, even though the table itself
 * already sat in its own `overflow-x-auto` wrapper — `<main>`'s own
 * `min-w-0` (Milestone 5 Batch 12) does not cascade through nested flex
 * containers; each nested flex item needs its own. Fixed in both routes.
 */
async function createPortfolioAndNavigateTo(page: Page, name: string, navLinkName: string) {
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
    .getByRole('link', { name: navLinkName, exact: true })
    .click();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: no horizontal page scrolling on the Loop Builder — ${name}`, async ({ page }) => {
    await createPortfolioAndNavigateTo(page, 'Loop Builder Overflow Check', 'Loop Builder');
    await page.waitForURL('**/loop-builder');
    // 0.5 is the form's own default — a genuinely different value is
    // required to force a real, observable recalculation.
    await fillByLabel(page, 'How much to borrow each loop', '60');
    await page.waitForTimeout(400);

    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Loop Builder' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('Cover: Loop Steps table scrolls within its own container, not the page, at mobile width', async ({
  page,
}) => {
  await createPortfolioAndNavigateTo(page, 'Loop Builder Table Scroll Check', 'Loop Builder');
  await page.waitForURL('**/loop-builder');
  await fillByLabel(page, 'How much to borrow each loop', '60');
  await page.waitForTimeout(400);

  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(100);

  const table = page.getByRole('table', { name: 'Loop strategy steps' });
  await expect(table).toBeVisible();
  const tableContainer = table.locator('..');
  const scrollInfo = await tableContainer.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);
  await expectNoHorizontalOverflow(page);
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: no horizontal page scrolling on the Exit Planner — ${name}`, async ({ page }) => {
    await createPortfolioAndNavigateTo(page, 'Exit Planner Overflow Check', 'Exit Planner');
    await page.waitForURL('**/exit-planner');
    await page.getByRole('button', { name: 'Full Exit' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Run Price Sensitivity' }).click();
    await page.waitForTimeout(200);

    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Exit Planner' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('Cover: Exit Price Sensitivity table scrolls within its own container, not the page, at mobile width', async ({
  page,
}) => {
  await createPortfolioAndNavigateTo(page, 'Exit Planner Table Scroll Check', 'Exit Planner');
  await page.waitForURL('**/exit-planner');
  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Run Price Sensitivity' }).click();
  await page.waitForTimeout(200);

  await page.setViewportSize(VIEWPORTS.mobile);
  await page.waitForTimeout(100);

  const table = page.getByRole('table', { name: 'Exit price sensitivity' });
  await expect(table).toBeVisible();
  const tableContainer = table.locator('..');
  const scrollInfo = await tableContainer.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);
  await expectNoHorizontalOverflow(page);
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`Cover: no horizontal page scrolling on the Recommendation Center — ${name}`, async ({
    page,
  }) => {
    await createPortfolioAndNavigateTo(
      page,
      'Recommendation Center Overflow Check',
      'Recommendations',
    );
    await page.waitForURL('**/recommendations');
    await page.waitForTimeout(200);

    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    await expect(page.getByRole('heading', { name: 'Recommendation Center' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

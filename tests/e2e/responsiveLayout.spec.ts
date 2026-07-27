import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Dashboard Responsive Layout End-to-End Tests — 06_TASKS.md M5-023
 * ("Implement Dashboard Responsive Layout"). Requirement: "No horizontal
 * page scrolling." DoD: "All Dashboard functionality remains usable on
 * mobile, tablet, and desktop."
 *
 * A real-browser, real-viewport check is the only honest way to verify
 * "no horizontal page scrolling" — Vitest/Testing Library run in jsdom,
 * which does not compute real box layout, so this property cannot be
 * unit-tested. This file is the permanent regression test for the two
 * real overflow bugs Batch 12's own manual audit found and fixed
 * (`AppHeader`'s unconstrained `<select>`, `PortfolioCompositionSection`'s
 * cramped table at exactly the 768px sidebar-appears breakpoint, and the
 * `<main>` `min-w-0` fix in `AppShell` that lets its own
 * `overflow-x-auto` actually contain that table instead of widening the
 * page) — a name-only, viewport-width-only reproduction of a bug that
 * would not otherwise be exercised by any per-component unit test.
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
  await fillByLabel(page, 'Maximum LTV (0–1)', '0.75');
  await fillByLabel(page, 'Liquidation threshold (0–1)', '0.8');
  await fillByLabel(page, 'Borrow APR (0–1)', '0.05');
  await fillByLabel(page, 'Supply APR (0–1)', '0.02');
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

  const tableContainer = page.locator('table').locator('..');
  const scrollInfo = await tableContainer.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);

  await tableContainer.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(page.getByText('Portfolio %')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

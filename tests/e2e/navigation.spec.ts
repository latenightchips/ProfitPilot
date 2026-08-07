import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Browser Navigation End-to-End Tests — 06_TASKS.md M9-019 ("Test Browser
 * Navigation Behavior"). Dependencies: M9-016. Include: "Back, Forward,
 * Refresh, Deep links, Direct route entry, Session restoration,
 * Unsaved-change handling." DoD: "Browser navigation does not corrupt
 * state or create unintended duplicate records."
 *
 * **A genuine, real gap closed, not duplicated coverage** — before this
 * batch this file held exactly the two trivial tests below (dashboard
 * landing page, one sidebar click); no other e2e spec exercises
 * `page.goBack()`/`page.goForward()`/`page.reload()`, or deep-links
 * directly to a non-root route (every other spec's helper functions use
 * `page.goto('/portfolios/new', ...)` as pure setup plumbing, never as a
 * deliberate navigation-behavior assertion) — confirmed by direct
 * inspection of every file in this directory before writing these, not
 * assumed.
 *
 * **Every other spec in this directory deliberately avoids `page.goto()`
 * mid-flow, per `portfolioWorkflows.spec.ts`'s own header comment**
 * ("no mid-flow `page.goto()`, which reloads the document and wipes the
 * in-memory Zustand store — Conflict B"). That comment predates
 * Milestone 8's local storage persistence (M8-006–M8-013): a real
 * document reload today rehydrates every Store from `localStorage` via
 * `PersistenceProvider` (already proven at the unit level by
 * `tests/unit/providers/PersistenceProvider.restartRecovery.test.tsx`,
 * M9-014) rather than losing state outright. This file is the one place
 * that deliberately *does* reload/deep-link, specifically to verify that
 * real, current behavior at the actual-browser level M9-014's own unit
 * tests cannot reach.
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
  await expect(page.getByRole('status')).toHaveText('Saved');
}

async function portfolioRowCount(page: Page, name: string): Promise<number> {
  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  return page.getByRole('list').locator('li', { hasText: name }).count();
}

test('dashboard is the default landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('sidebar links navigate to each primary page', async ({ page }) => {
  await page.goto('/');
  // Scoped to the sidebar's own "Primary" nav landmark
  // (`components/layout/AppSidebar.tsx`) — a plain, unscoped
  // `getByRole('link', { name: 'Portfolio' })` became ambiguous once
  // `AppHeader`'s portfolio switcher (M4-010) added its own
  // "View portfolios"/"No portfolios yet — create one" links, both of
  // which also match "Portfolio" as a case-insensitive substring.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio' })
    .click();
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
});

test('Cover: Direct route entry with no active portfolio shows a graceful gate, not a crash (M9-019)', async ({
  page,
}) => {
  for (const route of ['/simulation', '/loop-builder', '/exit-planner', '/recommendations']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.getByText(/No portfolio is currently selected/)).toBeVisible();
  }
});

test('Cover: Deep link directly to a tool route loads the already-active portfolio (M9-019)', async ({
  page,
}) => {
  await createPortfolio(page, 'Deep Link Portfolio');

  // A true top-level navigation (not an in-app `<Link>` click) straight
  // to a route this test never visited via any prior in-app click —
  // proves the Store rehydrates from `localStorage` on this fresh
  // document load, not only that in-memory state survived a client-side
  // route change.
  await page.goto('/simulation', { waitUntil: 'networkidle' });
  await expect(page.getByRole('complementary', { name: 'Scenario Controls' })).toBeVisible();
});

test('Cover: Browser refresh restores the active portfolio without creating a duplicate (M9-019)', async ({
  page,
}) => {
  await createPortfolio(page, 'Refresh Portfolio');
  expect(await portfolioRowCount(page, 'Refresh Portfolio')).toBe(1);

  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });

  await expect(page.getByLabel('Portfolio name')).toHaveValue('Refresh Portfolio');
  expect(await portfolioRowCount(page, 'Refresh Portfolio')).toBe(1);
});

test('Cover: Back and Forward navigate through visited routes without corrupting state or duplicating records (M9-019)', async ({
  page,
}) => {
  await createPortfolio(page, 'History Portfolio');
  // History so far: /portfolios/new -> /portfolio (createPortfolio's own
  // navigation). Extend it with two more in-app clicks.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel('Portfolio name')).toHaveValue('History Portfolio');

  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();

  // The back/forward round trip above must not have re-triggered
  // portfolio creation or any other duplicate-record side effect.
  expect(await portfolioRowCount(page, 'History Portfolio')).toBe(1);
});

test('Cover: Navigating away from a partially filled portfolio form does not create a partial or duplicate record (M9-019)', async ({
  page,
}) => {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', 'Abandoned Draft');
  await fillByLabel(page, 'BTC quantity', '2');
  // Deliberately never clicks "Create Portfolio" — navigates away via the
  // sidebar instead, the same way a real user closing the form mid-fill
  // would.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByText('No portfolios yet', { exact: true })).toBeVisible();
});

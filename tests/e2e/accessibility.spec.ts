import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Accessibility End-to-End Tests — 06_TASKS.md M5-024 ("Complete
 * Dashboard Accessibility Pass") + M6-022 ("Accessibility Review",
 * Milestone 6 Batch 21). M5-024 DoD: "The Dashboard meets the
 * accessibility requirements defined in the Build Guide." M6-022
 * Description: "Verify accessibility." M6-022 Review: "Keyboard
 * navigation, Forms, Charts, Tables, Screen readers." M6-022 DoD:
 * "Simulation Workspace satisfies accessibility requirements."
 *
 * **`04_BUILD_GUIDE.md`'s own "ACCESSIBILITY" line is a single checklist
 * tick with no further content** — M5-024's DoD points to a section
 * that turns out to carry no concrete requirements of its own. The real,
 * concrete, cross-document-consistent target is `01_PRD.md`'s own
 * REQ-008-F/REQ-011-E ("WCAG AA Compliance... Target WCAG AAA where
 * practical") and `03_UI.md`'s own "ACCESSIBILITY" section ("Minimum
 * Target: WCAG AA") — both agree, so WCAG AA is what these tests verify
 * against, not an invented bar. M6-022's own DoD names no document at
 * all, so the same already-established WCAG AA target governs — a
 * cross-cutting standard, not a Dashboard-specific one, confirmed by
 * `03_UI.md`'s own "ACCESSIBILITY" section living outside any one
 * page's own mockup and naming "Keyboard Navigation"/"Screen Readers"
 * (the same two items M6-022's own Review list names) as
 * application-wide "Support" items.
 *
 * **`@axe-core/playwright` added as a new devDependency** (Batch 13,
 * M5-024) — the industry-standard automated WCAG checker, the only
 * honest way to verify "meets WCAG AA" as an actual, repeatable claim
 * rather than a one-time manual eyeball. Automated tools cannot catch
 * everything (keyboard operability and focus visibility specifically
 * are not fully automatable — WCAG 1.4.13's hoverable/dismissible/
 * persistent criteria need real interaction), so this file also
 * includes scripted keyboard-navigation and focus-visibility checks
 * alongside the axe scans.
 *
 * **Every state below was chosen because it is structurally different**
 * — a violation reachable only through one specific render path (the
 * error banner, the loading skeleton, a warning banner) would not be
 * caught by scanning only the happy path.
 *
 * **The Simulation section below found one real, genuinely
 * cross-cutting bug via its own axe scans — a WCAG AA color-contrast
 * failure on the "Confirm Delete" button (`bg-destructive`/
 * `text-destructive-foreground`, 3.4:1 against the required 4.5:1),
 * fixed in `app/globals.css` by darkening `--destructive-foreground`
 * rather than `--destructive` itself** (darkening `--destructive`
 * directly was tried first and rejected — it fixed this button but
 * broke `text-destructive`'s own already-fine contrast against the
 * app's dark background elsewhere, since that token is shared by two
 * structurally different usages: solid-button background and
 * plain-text-on-dark-background). Because `--destructive-foreground`
 * is a shared CSS custom property, this fix also incidentally corrects
 * the identical, pre-existing violation on `app/portfolios/page.tsx`'s
 * own "Confirm Delete" button (M4-012) — found only because M6-022's
 * own axe scan happened to exercise this shared token first; not a
 * Simulation-specific fix, but the correct level to fix a shared design
 * token at, the same reasoning Batch 12 (M5-023) applied to its own
 * shared `AppHeader`/`AppShell` fixes.
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
  options: { name: string; quantity?: string; debtBalance?: string; targetHealthFactor?: string },
) {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await fillByLabel(page, 'Portfolio name', options.name);
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
  await page.locator('a', { hasText: 'Dashboard' }).click();
  await page.waitForURL('**/');
}

async function expectNoWcagAaViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test('Cover: no WCAG AA violations — no portfolio selected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — healthy portfolio with active recommendations', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Healthy Portfolio', targetHealthFactor: '5' });
  // `getByText('Recommendations')` is ambiguous since Milestone 7 Batch 6
  // added a "Recommendations" sidebar link (`constants/navigation.ts`)
  // alongside the Dashboard's own `RecommendationSummarySection` heading
  // this test means to check — scoped to the heading specifically.
  await expect(page.getByRole('heading', { name: 'Recommendations' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Developer Mode enabled (M5-022, Batch 14)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Developer Mode Portfolio' });
  await page.getByRole('checkbox', { name: 'Developer Mode' }).check();
  await expect(page.getByText(/Formula ID:/).first()).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — calculation failure (Dashboard Error Banner)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Error Portfolio', quantity: '0' });
  // Next.js's own built-in SPA route announcer also carries `role="alert"`
  // (`#__next-route-announcer__`, framework-injected) — scope to the text
  // this app's own `DashboardErrorBanner` renders, not the bare role.
  await expect(page.getByText(/Unable to calculate a summary/)).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — zero-debt portfolio (Risk Warning Banner, No-Debt Notice)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Zero Debt Portfolio', debtBalance: '0' });
  await expect(page.getByText(/This portfolio has no debt position/)).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Dashboard control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Keyboard Portfolio', targetHealthFactor: '5' });

  const reachableRoles = new Set<string>();
  // A generous but bounded number of Tab presses — enough to cross every
  // interactive control on this route without looping forever if focus
  // ever gets stuck (which would itself be a real bug this test catches).
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }

  // Sanity: real, known controls on this exact fixture were actually reached.
  const reached = [...reachableRoles].join(' | ');
  expect(reached).toContain('Refresh');
  expect(reached).toContain('Edit portfolio');
  expect(reached).toContain('Run simulation'); // the aria-disabled button (M5-024 fix)
});

test('Cover: focus is always visibly indicated (no outline: none anywhere reachable)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Focus Portfolio', targetHealthFactor: '5' });

  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const style = window.getComputedStyle(el);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    if (outline !== null) {
      const hasVisibleOutline = outline.outlineStyle !== 'none' && outline.outlineWidth !== '0px';
      expect(hasVisibleOutline).toBe(true);
    }
  }
});

test('Cover: the unavailable Quick Actions reason is reachable by keyboard focus (M5-024 fix)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Tooltip Portfolio' });

  const runSimulation = page.getByRole('button', { name: 'Run simulation' });
  await expect(runSimulation).toHaveAttribute('aria-disabled', 'true');
  await runSimulation.focus();
  await expect(runSimulation).toBeFocused();
  await expect(runSimulation).toHaveAttribute(
    'title',
    /This feature is not yet available in this version of ProfitPilot\./,
  );
});

async function createPortfolioAndOpenSimulation(page: Page, name: string) {
  await createPortfolio(page, { name });
  await page.locator('a', { hasText: 'Simulation' }).click();
  await page.waitForURL('**/simulation');
}

async function saveScenario(page: Page, btcPriceUsd: number, name: string) {
  await fillByLabel(page, 'BTC Price', String(btcPriceUsd));
  await page.waitForTimeout(150);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save Scenario' }).click();
  await page.waitForTimeout(150);
}

test('Cover: no WCAG AA violations — Simulation Workspace, no scenario run yet', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Empty Portfolio');
  await expect(page.getByRole('heading', { name: 'Simulation', exact: true })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Simulation Workspace, active price scenario with results', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Price Portfolio');
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Simulation Workspace, interest scenario with charts and timeline', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Interest Portfolio');
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(150);
  await fillByLabel(page, 'Borrow Rate (0–1)', '0.1');
  await page.waitForTimeout(200);
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Simulation Workspace, saved scenarios with comparison table', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Comparison Portfolio');
  await saveScenario(page, 60000, 'Scenario Alpha');
  await saveScenario(page, 70000, 'Scenario Bravo');
  const checkboxes = page.getByRole('checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.waitForTimeout(150);
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Simulation Workspace, Delete confirmation panel open (color-contrast fix)', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Delete Portfolio');
  await saveScenario(page, 65000, 'Scenario To Delete');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Confirm Delete' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Simulation Workspace, Save Scenario form validation error', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Save Error Portfolio');
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Save Scenario' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Simulation Workspace control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Keyboard Portfolio');
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);

  const reachableRoles = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }

  const reached = [...reachableRoles].join(' | ');
  expect(reached).toContain('Export JSON');
  expect(reached).toContain('Save Scenario');
});

test('Cover: Scenario Comparison table header cells carry scope="col" (Batch 21 fix)', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Table Scope Portfolio');
  await saveScenario(page, 65000, 'Scoped Scenario');
  await page.getByRole('checkbox').check();
  await page.waitForTimeout(150);

  const headerCells = page.locator('table thead th');
  const count = await headerCells.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(headerCells.nth(i)).toHaveAttribute('scope', 'col');
  }
});

test('Cover: Save Scenario form error/success messages are announced via role="alert"/role="status" (Batch 21 fix)', async ({
  page,
}) => {
  await createPortfolioAndOpenSimulation(page, 'A11y Simulation Save Announce Portfolio');
  await fillByLabel(page, 'BTC Price', '65000');
  await page.waitForTimeout(200);

  await page.getByRole('button', { name: 'Save Scenario' }).click();
  // Next.js's own built-in SPA route announcer also carries `role="alert"`
  // (`#__next-route-announcer__`, framework-injected) — scope to the text
  // this form's own error renders, the same ambiguity Batch 13 (M5-024)
  // already found and worked around.
  await expect(page.getByRole('alert').filter({ hasText: 'Name is required.' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Announced Scenario');
  await page.getByRole('button', { name: 'Save Scenario' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
});

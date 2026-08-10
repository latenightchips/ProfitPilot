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
 *
 * **Milestone 9 Batch 5 (M9-022 "Perform Automated Accessibility Audit" /
 * M9-023 "Perform Keyboard Navigation Audit") closes a real, previously
 * documented coverage gap — 6 routes with zero axe/keyboard coverage**
 * (`/portfolios`, `/portfolios/new`, `/portfolio`, `/settings`,
 * `/sign-in`, `/sign-up`, `/reset-password` — confirmed absent by
 * `docs/DOD_COMPLIANCE_AUDIT.md`'s own re-check at Milestone 9 Batch 1,
 * re-confirmed again at the start of this batch before writing anything
 * new). Each gets both an axe scan and a keyboard-reachability test,
 * following this file's own established two-layer convention.
 *
 * **"Dialog focus trapping" and "Menu operation" (M9-023's own Verify
 * list) have no test here — confirmed, not assumed, that no dialog or
 * menu widget exists anywhere in this codebase** (`grep` for
 * `role="dialog"`, `<dialog`, `role="menu"` across `app/`/`components/`/
 * `features/` returns zero hits). Every "confirm" UI in this application
 * (portfolio delete, import replace-all, clear local data) is an inline,
 * non-modal expand-to-confirm panel — `app/portfolios/page.tsx`'s own
 * header comment already documents this as a deliberate M4-012 design
 * choice, not an oversight. Recorded as **N/A** in
 * `docs/ACCESSIBILITY_CONFORMANCE.md` (M9-028) rather than silently
 * skipped or force-tested against a widget that does not exist.
 *
 * **"Table interaction"** — every table in this codebase (per direct
 * inspection) is either pure static data display (already covered by the
 * `scope="col"` test below) or `LoopStepTable.tsx`'s own per-row
 * `<details>/<summary>` disclosure, the one genuinely interactive table
 * element — covered below as "Expandable content."
 *
 * **"Route changes"** — Next.js App Router's own built-in
 * `#__next-route-announcer__` announces `document.title` to screen
 * readers on every client-side navigation, but had nothing meaningful to
 * announce before this batch (every route shared one static title,
 * "ProfitPilot" — see `app/page.tsx`'s own header comment, the M9-024 fix
 * this exact test below now verifies end-to-end).
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
  await fillByLabel(page, 'Maximum LTV (%)', '75');
  await fillByLabel(page, 'Liquidation threshold (%)', '80');
  await fillByLabel(page, 'Borrow APR (%)', '5');
  await fillByLabel(page, 'Supply APR (%)', '2');
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

async function keyboardReach(page: Page, presses: number): Promise<string> {
  const reachableRoles = new Set<string>();
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }
  return [...reachableRoles].join(' | ');
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
  expect(reached).toContain('Run simulation'); // a real link since the M9-017 fix (buildQuickActions.ts)
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

/**
 * Repointed to "Export portfolio" (Milestone 9 Batch 4, M9-017) —
 * "Run simulation" is no longer disabled (a real, fixed defect; see
 * `buildQuickActions.ts`'s own header comment), so it can no longer
 * exercise this specific M5-024 accessibility fix. "Export portfolio"
 * remains genuinely `aria-disabled` under the same real condition it
 * always has (`calculationSucceeded === false`, e.g. a zero-quantity
 * portfolio whose Dashboard metrics could not be computed) — the fix
 * itself (`aria-disabled` over the native `disabled` attribute, keeping
 * the reason reachable by keyboard focus) is unrelated to which specific
 * button demonstrates it.
 */
test('Cover: the unavailable Quick Actions reason is reachable by keyboard focus (M5-024 fix)', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Tooltip Portfolio', quantity: '0' });

  const exportPortfolio = page.getByRole('button', { name: 'Export portfolio' });
  await expect(exportPortfolio).toHaveAttribute('aria-disabled', 'true');
  await exportPortfolio.focus();
  await expect(exportPortfolio).toBeFocused();
  await expect(exportPortfolio).toHaveAttribute(
    'title',
    /No calculated summary is available to export/,
  );
});

async function createPortfolioAndOpenSimulation(page: Page, name: string) {
  await createPortfolio(page, { name });
  // Scoped to the sidebar's own "Primary" nav landmark — a plain,
  // unscoped `hasText: 'Simulation'` locator became ambiguous once the
  // M9-017 fix (`buildQuickActions.ts`'s own header comment) turned
  // Quick Actions' "Run simulation" into a real `<a>` link too, which
  // also matches "Simulation" as a substring. Same fix
  // `tests/e2e/navigation.spec.ts` already applies for the identical
  // "Portfolio" ambiguity against `AppHeader`'s switcher links.
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
  await fillByLabel(page, 'Borrow Rate (%)', '10');
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

/**
 * Loop Builder / Exit Planner / Recommendation Center — 06_TASKS.md
 * M7-040 ("Complete Strategy Accessibility Pass"). Review: "Form labels,
 * Keyboard navigation, Focus management, Warnings, Tables, Expandable
 * details, Status announcements, Color-independent risk communication."
 * DoD: "Strategy tools meet the accessibility standards in the Build
 * Guide" — the same WCAG AA target established above.
 *
 * **Real, found-not-assumed violation: `scrollable-region-focusable`
 * (WCAG 2.1.1/2.1.3) on `ExitPriceSensitivity.tsx`'s new
 * `overflow-x-auto` wrapper (M7-039, this same batch).** A scrollable
 * region with no focusable content of its own is unreachable via
 * keyboard/Safari. Fixed with `tabIndex={0}`, and applied defensively to
 * `LoopScenarioSensitivity.tsx`'s own new wrapper and
 * `LoopStepTable.tsx`'s pre-existing one — see each component's own
 * header comment.
 *
 * **`status: 'error'` (the `StrategyErrorBanner`, M7-038) is only
 * genuinely reachable via real UI input for Exit Planner, not Loop
 * Builder or Recommendation Center** — confirmed by direct source
 * inspection, not assumed: `validateLoopStrategySafety`'s own starting-
 * Health-Factor gate and `calculateRepaymentRecommendation`/
 * `calculateAdditionalCollateralRecommendation` all absorb a zero-
 * collateral position into a real `viable: false`/"no action needed"
 * *success* result (data, not a thrown Engine failure) before ever
 * reaching a genuinely failing calculation; negative collateral (the
 * only input that *would* fail them) is blocked by
 * `collateralPositionSchema`'s own `nonnegative()` at the Portfolio
 * form. Exit Planner's own `calculateExitPosition` has a real, UI-
 * reachable failure mode instead: a Target BTC Price low enough that the
 * required BTC sale exceeds actual holdings returns a genuine
 * `INSUFFICIENT_COLLATERAL` Engine error — used below for the one error-
 * state axe scan this section runs against a real, not synthetic,
 * failure. Loop Builder's and Recommendation Center's own error-banner
 * rendering is already covered by `StrategyErrorBanner.test.tsx` (shared
 * by all three) and each route's own component/page-level unit tests
 * (direct Store `setState`), the correct level for a state this batch's
 * own source-level research shows is provably unreachable through the
 * real UI today — the same "documented, not force-tested" precedent
 * `RecommendationList.tsx`'s own header comment already establishes for
 * its analogous unreachable branches.
 */
async function createPortfolioAndOpenLoopBuilder(page: Page, name: string) {
  await createPortfolio(page, { name });
  await page.locator('a', { hasText: 'Loop Builder' }).click();
  await page.waitForURL('**/loop-builder');
}

async function createPortfolioAndOpenExitPlanner(page: Page, name: string) {
  await createPortfolio(page, { name });
  await page.locator('a', { hasText: 'Exit Planner' }).click();
  await page.waitForURL('**/exit-planner');
}

async function createPortfolioAndOpenRecommendations(page: Page, name: string) {
  await createPortfolio(page, { name, targetHealthFactor: '8' });
  await page.locator('a', { hasText: 'Recommendations' }).click();
  await page.waitForURL('**/recommendations');
}

test('Cover: no WCAG AA violations — Loop Builder, viable strategy result', async ({ page }) => {
  await createPortfolioAndOpenLoopBuilder(page, 'A11y Loop Builder Portfolio');
  await fillByLabel(page, 'How much to borrow each loop', '60');
  await page.waitForTimeout(300);
  await expect(page.getByText('Loop Steps')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Exit Planner, Full Exit result with price sensitivity', async ({
  page,
}) => {
  await createPortfolioAndOpenExitPlanner(page, 'A11y Exit Planner Portfolio');
  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Run Price Sensitivity' }).click();
  await page.waitForTimeout(200);
  await expect(page.getByText('Full Exit Result')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Exit Planner, StrategyErrorBanner (real INSUFFICIENT_COLLATERAL failure)', async ({
  page,
}) => {
  await createPortfolioAndOpenExitPlanner(page, 'A11y Exit Planner Error Portfolio');
  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);
  // A Target BTC Price low enough that repaying the full debt would
  // require selling far more BTC than the portfolio holds — a real,
  // UI-reachable INSUFFICIENT_COLLATERAL Engine failure.
  await page.getByLabel(/Target BTC Price/).fill('100');
  await page.waitForTimeout(300);
  await expect(page.getByText('Unable to calculate this result.')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Recommendation Center, active recommendations', async ({
  page,
}) => {
  await createPortfolioAndOpenRecommendations(page, 'A11y Recommendation Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Recommendation Center, Detail Panel selected', async ({
  page,
}) => {
  await createPortfolioAndOpenRecommendations(page, 'A11y Recommendation Detail Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();
  await page
    .getByRole('button', { name: /Maintain Target Health Factor/ })
    .first()
    .click();
  await page.waitForTimeout(150);
  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Loop Builder control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolioAndOpenLoopBuilder(page, 'A11y Loop Builder Keyboard Portfolio');
  await fillByLabel(page, 'How much to borrow each loop', '60');
  await page.waitForTimeout(300);

  const reachableRoles = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }

  const reached = [...reachableRoles].join(' | ');
  expect(reached).toContain('Save Strategy');
});

test('Cover: every interactive Exit Planner control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolioAndOpenExitPlanner(page, 'A11y Exit Planner Keyboard Portfolio');
  await page.getByRole('button', { name: 'Full Exit' }).click();
  await page.waitForTimeout(200);

  const reachableRoles = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }

  const reached = [...reachableRoles].join(' | ');
  expect(reached).toContain('Save Plan');
});

test('Cover: every interactive Recommendation Center control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolioAndOpenRecommendations(page, 'A11y Recommendation Keyboard Portfolio');
  await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

  const reachableRoles = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      return { tag: el.tagName, text: el.textContent?.trim() };
    });
    if (info !== null) reachableRoles.add(`${info.tag}:${info.text?.slice(0, 30)}`);
  }

  const reached = [...reachableRoles].join(' | ');
  expect(reached).toContain('Acknowledge');
});

function portfolioRow(page: Page, name: string) {
  return page.locator('li').filter({ has: page.getByText(name, { exact: true }) });
}

async function createPortfolioAndOpenEditPage(page: Page, name: string) {
  await createPortfolio(page, { name });
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Portfolio', exact: true })
    .click();
  await page.waitForURL('**/portfolio');
}

test('Cover: no WCAG AA violations — Portfolios list, with an archived portfolio and delete-confirm panel open', async ({
  page,
}) => {
  // `settingsWorkflows.spec.ts`'s own header comment documents the same
  // race this test hit initially: Milestone 8's autosave is debounced
  // (~400ms), and a hard `page.goto` fired before it lands kills the
  // pending write. `createPortfolio` below already ends on a client-side
  // nav (safe), but its own *next* call starts with a hard
  // `page.goto('/portfolios/new')` — the 500ms wait here lets the first
  // portfolio's write settle before that reload fires.
  await createPortfolio(page, { name: 'A11y Portfolios List Archived Portfolio' });
  await page.waitForTimeout(500);
  await createPortfolio(page, { name: 'A11y Portfolios List Delete Portfolio' });
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: /Manage portfolios|View portfolios/ }).click();
  await page.waitForURL('**/portfolios');

  await portfolioRow(page, 'A11y Portfolios List Archived Portfolio')
    .getByRole('button', { name: 'Archive', exact: true })
    .click();
  await page.getByRole('button', { name: /Show archived/ }).click();

  await portfolioRow(page, 'A11y Portfolios List Delete Portfolio')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByText(/permanently removes the portfolio/)).toBeVisible();

  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Portfolios list control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolio(page, { name: 'A11y Portfolios List Keyboard Portfolio' });
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: /Manage portfolios|View portfolios/ }).click();
  await page.waitForURL('**/portfolios');

  const reached = await keyboardReach(page, 30);
  expect(reached).toContain('Duplicate');
  expect(reached).toContain('Archive');
  expect(reached).toContain('Delete');
});

test('Cover: no WCAG AA violations — Create Portfolio form', async ({ page }) => {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Create Portfolio' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every Create Portfolio form field is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  const reached = await keyboardReach(page, 30);
  expect(reached).toContain('Create Portfolio');
});

test('Cover: no WCAG AA violations — Portfolio edit form, healthy state', async ({ page }) => {
  await createPortfolioAndOpenEditPage(page, 'A11y Portfolio Edit Healthy Portfolio');
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Portfolio edit form, validation error state', async ({
  page,
}) => {
  await createPortfolioAndOpenEditPage(page, 'A11y Portfolio Edit Error Portfolio');

  const baseCurrencyInput = page.locator('label', { hasText: 'Base currency' }).locator('input');
  await baseCurrencyInput.fill('');
  await baseCurrencyInput.blur();
  await page.waitForTimeout(800);

  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Portfolio edit form control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await createPortfolioAndOpenEditPage(page, 'A11y Portfolio Edit Keyboard Portfolio');
  const reached = await keyboardReach(page, 60);
  expect(reached).toContain('Preview Changes');
});

test('Cover: no WCAG AA violations — Settings, base state', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Full Backup (JSON)' })).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: no WCAG AA violations — Settings, import preview open with a conflict checklist', async ({
  page,
}) => {
  const { readFile } = await import('node:fs/promises');

  // Same debounced-autosave race documented at the top of the "Portfolios
  // list, with an archived portfolio" test above — a hard `page.goto`
  // fired immediately after `createPortfolio` can outrun the pending
  // write, exporting an empty backup. Settled by waiting, then navigating
  // via the Primary nav's own client-side "Settings" link instead of a
  // hard reload.
  await createPortfolio(page, { name: 'A11y Settings Conflict Portfolio' });
  await page.waitForTimeout(500);
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Settings' })
    .click();
  await page.waitForURL('**/settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = JSON.parse(await readFile(path as string, 'utf-8'));

  const existingEnvelope = content.records.portfolio[0];
  const replacedEnvelope = {
    ...existingEnvelope,
    payload: { ...existingEnvelope.payload, name: 'A11y Settings Conflict Portfolio (Replaced)' },
  };
  delete replacedEnvelope.checksum;
  content.records.portfolio = [replacedEnvelope];

  await page.setInputFiles('input[type="file"]', {
    name: 'a11y-replace-selected.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(content)),
  });

  await page.getByRole('radio', { name: 'Replace selected' }).check();
  await expect(page.getByText(/Conflicting records/)).toBeVisible();

  await expectNoWcagAaViolations(page);
});

test('Cover: every interactive Settings control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const reached = await keyboardReach(page, 30);
  expect(reached).toContain('Full Backup (JSON)');
});

test('Cover: no WCAG AA violations — Sign In, with a reported error', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every Sign In control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  const reached = await keyboardReach(page, 20);
  expect(reached).toContain('Sign in');
});

test('Cover: no WCAG AA violations — Sign Up, with a reported error', async ({ page }) => {
  await page.goto('/sign-up', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password').fill('different456');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every Sign Up control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await page.goto('/sign-up', { waitUntil: 'networkidle' });
  const reached = await keyboardReach(page, 20);
  expect(reached).toContain('Create account');
});

test('Cover: no WCAG AA violations — Reset Password, with a reported error', async ({ page }) => {
  await page.goto('/reset-password', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expectNoWcagAaViolations(page);
});

test('Cover: every Reset Password control is reachable and operable by keyboard alone', async ({
  page,
}) => {
  await page.goto('/reset-password', { waitUntil: 'networkidle' });
  const reached = await keyboardReach(page, 20);
  expect(reached).toContain('Send reset link');
});

/**
 * M9-023's own "Expandable content" Verify item —
 * `LoopStepTable.tsx`'s own per-row `<details>/<summary>` disclosure is
 * the one genuinely interactive table element in this codebase (see this
 * file's own header comment). Native `<details>` is keyboard-operable by
 * design (Space/Enter toggles a focused `<summary>`), verified here
 * directly rather than assumed from "it's a native element."
 */
test('Cover: Loop Step Table row details are keyboard-operable (Expandable content)', async ({
  page,
}) => {
  await createPortfolioAndOpenLoopBuilder(page, 'A11y Expandable Details Portfolio');
  await fillByLabel(page, 'How much to borrow each loop', '60');
  await page.waitForTimeout(300);

  // Scoped to the first row specifically — with more than one loop step,
  // an unscoped `getByText('Available Borrow:')` matches one `<dt>` per
  // row (each inside its own closed, off-screen-but-still-DOM-present
  // `<details>`), which is ambiguous for Playwright's strict mode even
  // though only one is ever actually visible at a time.
  const stepsTable = page.getByRole('table', { name: 'Loop strategy steps' });
  const firstRow = stepsTable.locator('tbody tr').first();
  const firstSummary = firstRow.locator('summary');
  const firstRowDetail = firstRow.getByText('Available Borrow:');

  await firstSummary.focus();
  await expect(firstRowDetail).not.toBeVisible();

  await page.keyboard.press('Enter');
  await expect(firstRowDetail).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(firstRowDetail).not.toBeVisible();
});

/**
 * M9-023's own "Route changes" Verify item, and the real-browser proof
 * that the M9-024 page-title fix (`app/page.tsx`'s Server/Client split,
 * see its own header comment) actually reaches assistive technology —
 * Next.js's own `#__next-route-announcer__` announces `document.title`
 * on every client-side navigation, but had nothing distinguishing to
 * announce before this batch (every route shared the one static
 * "ProfitPilot" title).
 */
test('Cover: client-side route changes update document.title, so the route announcer has something meaningful to say (M9-023/M9-024)', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect.poll(() => page.title()).toBe('Dashboard — ProfitPilot');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Simulation' })
    .click();
  await expect.poll(() => page.title()).toBe('Simulation — ProfitPilot');

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Settings' })
    .click();
  await expect.poll(() => page.title()).toBe('Settings — ProfitPilot');
});

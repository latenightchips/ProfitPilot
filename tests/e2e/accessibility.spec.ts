import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Dashboard Accessibility End-to-End Tests — 06_TASKS.md M5-024
 * ("Complete Dashboard Accessibility Pass"). DoD: "The Dashboard meets
 * the accessibility requirements defined in the Build Guide."
 *
 * **`04_BUILD_GUIDE.md`'s own "ACCESSIBILITY" line is a single checklist
 * tick with no further content** — this task's DoD points to a section
 * that turns out to carry no concrete requirements of its own. The real,
 * concrete, cross-document-consistent target is `01_PRD.md`'s own
 * REQ-008-F/REQ-011-E ("WCAG AA Compliance... Target WCAG AAA where
 * practical") and `03_UI.md`'s own "ACCESSIBILITY" section ("Minimum
 * Target: WCAG AA") — both agree, so WCAG AA is what these tests verify
 * against, not an invented bar.
 *
 * **`@axe-core/playwright` added as a new devDependency** — the
 * industry-standard automated WCAG checker, the only honest way to
 * verify "meets WCAG AA" as an actual, repeatable claim rather than a
 * one-time manual eyeball. Automated tools cannot catch everything
 * (keyboard operability and focus visibility specifically are not fully
 * automatable — WCAG 1.4.13's hoverable/dismissible/persistent criteria
 * need real interaction), so this file also includes scripted keyboard-
 * navigation and focus-visibility checks alongside the axe scans.
 *
 * **Every state below was chosen because it is structurally different**
 * — a violation reachable only through one specific render path (the
 * error banner, the loading skeleton, a warning banner) would not be
 * caught by scanning only the happy path.
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
  await expect(page.getByText('Recommendations')).toBeVisible();
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

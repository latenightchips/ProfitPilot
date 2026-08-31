import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * V1.1 Batch 7 ("Mobile & Responsive Product Pass") — Section 12's own
 * minimum coverage list for the parts of this batch no existing spec
 * file already exercises at a real mobile viewport:
 *
 * - **Navigation**: `AppSidebar` was `hidden` below `md:` with no
 *   replacement before this batch (Milestone 5's own accepted,
 *   documented gap — `tests/e2e/mobileWorkflows.spec.ts`'s own header
 *   comment). `MobilePrimaryNav.tsx` is the fix; these tests are its
 *   only real-browser coverage.
 * - **Portfolio page at a phone viewport**: `responsiveLayout.spec.ts`
 *   covers Dashboard/Simulation/Loop Builder/Exit Planner/Recommendation
 *   Center at 375/768/1280px, but never `/portfolio` itself — confirmed
 *   by reading that file before writing this one, not assumed.
 * - **Portfolio History**: had zero E2E coverage of any kind before this
 *   batch (confirmed the same way) — these tests are its first, and the
 *   first real-browser proof that the new mobile card list (vs. the
 *   desktop table) actually swaps at the real `sm:` breakpoint, which
 *   jsdom-based component tests structurally cannot verify (both views
 *   are always present in jsdom; see `PortfolioHistoryPanel.test.tsx`'s
 *   own updated header comment).
 * - **Apply-to-Portfolio review at mobile width**: reached here via the
 *   Recommendation Detail Panel's "Review Apply to Portfolio" flow,
 *   reusing `recommendationWorkflows.spec.ts`'s own Target Health Factor
 *   8 fixture that is already known to produce an actionable, real
 *   `applyProposal`.
 */
const VIEWPORTS = {
  '320px': { width: 320, height: 720 },
  '375px': { width: 375, height: 812 },
  '390px': { width: 390, height: 844 },
  '430px': { width: 430, height: 932 },
};

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

async function createPortfolio(page: Page, name: string, targetHealthFactor?: string) {
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
  if (targetHealthFactor !== undefined) {
    await fillByLabel(page, 'Target Health Factor', targetHealthFactor);
  }
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
  await expect(page.getByRole('status')).toHaveText('Saved');
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

test.describe('Mobile primary navigation (V1.1 Batch 7, Section 3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['375px']);
  });

  test('Cover: hamburger toggle opens/closes the mobile nav with correct aria state', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggle = page.getByRole('button', { name: 'Menu' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Primary' })).not.toBeVisible();

    await toggle.click();
    await expect(page.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    for (const label of ['Dashboard', 'Portfolio', 'Simulation', 'Recommendations', 'Settings']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('navigation', { name: 'Primary' })).not.toBeVisible();
  });

  test('Cover: navigating via the mobile nav closes it and marks the active route', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Settings' })
      .click();
    await page.waitForURL('**/settings');

    // The panel closes on navigate (`onNavigate`) — reopening it should
    // show Settings, not Dashboard, as the active route.
    await expect(page.getByRole('navigation', { name: 'Primary' })).not.toBeVisible();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Settings' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('Cover: opening the mobile nav pushes page content down rather than covering it', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const heading = page.getByRole('heading', { name: 'Dashboard' });
    const beforeBox = await heading.boundingBox();

    await page.getByRole('button', { name: 'Menu' }).click();
    const afterBox = await heading.boundingBox();

    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();
    // The heading moved further down the page once the panel opened
    // (pushed, not overlaid) — a real, measured layout effect, not an
    // assumption from the class names alone.
    expect(afterBox!.y).toBeGreaterThan(beforeBox!.y);
    await expect(heading).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Portfolio page at a phone viewport (V1.1 Batch 7, Section 4)', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`Cover: no horizontal page scrolling on the Portfolio page — ${name}`, async ({
      page,
    }) => {
      await createPortfolio(page, `Portfolio Overflow Check ${name}`);
      // A second, materially different snapshot (any collateral quantity
      // change is always material — `isMaterialPortfolioHistoryChange`)
      // so History renders its chart, table, and card list, not just the
      // empty state, at every checked viewport.
      const collateralSection = page
        .locator('form')
        .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
      await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
      await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
      await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();
      await expect(page.getByRole('status')).toHaveText('Saved');
      await page.waitForTimeout(200);

      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);

      await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test('Cover: Portfolio History shows the mobile card list, not the table, below sm:', async ({
    page,
  }) => {
    await createPortfolio(page, 'History Mobile Card Portfolio');
    const collateralSection = page
      .locator('form')
      .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
    await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
    await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
    await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    // The second history snapshot is written asynchronously, fire-and-
    // forget, from the Store's own `update` action
    // (`attemptPortfolioHistorySnapshot`'s own header comment) —
    // `PortfolioHistoryPanel` only re-fetches on mount or when
    // `portfolio.updatedAt` changes, and recording history does not
    // itself change that field again, so a fetch that races ahead of the
    // write would never see it without a fresh mount. Waiting, then
    // reloading (a fresh mount, a fresh fetch), is what actually makes
    // this deterministic — a longer timeout on the assertion alone would
    // not retrigger a fetch.
    await page.waitForTimeout(800);
    await page.setViewportSize(VIEWPORTS['375px']);
    await page.reload({ waitUntil: 'networkidle' });

    const history = page.locator('section', {
      has: page.getByRole('heading', { name: 'History' }),
    });
    await expect(history.getByRole('list')).toBeVisible();
    await expect(history.getByRole('table')).not.toBeVisible();
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
  });

  test('Cover: Portfolio History shows the table, not the mobile card list, at sm: and above', async ({
    page,
  }) => {
    await createPortfolio(page, 'History Desktop Table Portfolio');
    const collateralSection = page
      .locator('form')
      .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
    await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
    await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
    await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    await page.waitForTimeout(200);

    const history = page.locator('section', {
      has: page.getByRole('heading', { name: 'History' }),
    });
    await expect(history.getByRole('table')).toBeVisible();
    await expect(history.getByRole('list')).not.toBeVisible();
  });
});

test.describe('Apply-to-Portfolio review at mobile width (V1.1 Batch 7, Section 7)', () => {
  test('Cover: the before/after grid stacks to one column, and Apply/Cancel/disclaimer stay reachable', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS['375px']);
    await createPortfolio(page, 'Apply Review Mobile Portfolio', '8');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Recommendations' })
      .click();
    await page.waitForURL('**/recommendations');
    await expect(page.getByRole('heading', { name: 'High' })).toBeVisible();

    await page.getByText('Current debt exceeds the target debt required').click();
    const detailPanel = page.getByRole('region', { name: 'Recommendation Detail' });
    await detailPanel.getByRole('button', { name: 'Review Apply to Portfolio' }).click();

    await expect(detailPanel.getByText(/does not execute transactions on Aave/i)).toBeVisible();
    // `dl.grid` is unique to `ApplyToPortfolioReview`'s own before/after
    // grid — the panel's other two `<dl>`s ("Current Values",
    // "Quantified Impact") are plain `flex flex-col` lists, not grids.
    const grid = detailPanel.locator('dl.grid');
    await expect(grid).toHaveClass(/grid-cols-1/);

    const applyButton = detailPanel.getByRole('button', { name: 'Apply to Portfolio' });
    const cancelButton = detailPanel.getByRole('button', { name: 'Cancel' });
    await expect(applyButton).toBeVisible();
    await expect(cancelButton).toBeVisible();
    const applyBox = await applyButton.boundingBox();
    const cancelBox = await cancelButton.boundingBox();
    expect(applyBox).not.toBeNull();
    expect(cancelBox).not.toBeNull();
    // Buttons do not overlap — Section 5's "action buttons do not become
    // tiny or overlap." Robust to either a side-by-side or a wrapped
    // (stacked) layout: true if the rectangles are separated on either
    // axis.
    const separatedHorizontally =
      applyBox!.x + applyBox!.width <= cancelBox!.x ||
      cancelBox!.x + cancelBox!.width <= applyBox!.x;
    const separatedVertically =
      applyBox!.y + applyBox!.height <= cancelBox!.y ||
      cancelBox!.y + cancelBox!.height <= applyBox!.y;
    expect(separatedHorizontally || separatedVertically).toBe(true);

    await expectNoHorizontalOverflow(page);

    await cancelButton.click();
    await expect(
      detailPanel.getByRole('button', { name: 'Review Apply to Portfolio' }),
    ).toBeVisible();
  });
});

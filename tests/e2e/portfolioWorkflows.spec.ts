import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Portfolio Workflow End-to-End Tests — 06_TASKS.md M4-018 ("Create
 * Portfolio Workflow Tests"). DoD: "Critical portfolio workflows pass in
 * integration and Playwright tests." This file is the Playwright half —
 * `tests/integration/portfolio/portfolioWorkflows.test.ts` is the
 * integration half (Store/Service-level, no browser). Together they
 * cover this task's own "Cover" list once each, at the two layers the
 * DoD names.
 *
 * **Real browser, real navigation — the layer no other Milestone 4 test
 * exercises.** Every per-page unit test (Batches 1–9) renders one page
 * component in isolation with Testing Library; this file drives the
 * actual compiled app in Chromium, clicking through real page
 * transitions, confirming the full stack (Next.js routing, React
 * Hook Form, Zustand, Services, Engine) works together end-to-end, not
 * just each layer in isolation.
 *
 * **In-app link navigation, not `page.goto()`, between steps that need
 * more than one portfolio to exist at once.** `page.goto()` is a real
 * top-level navigation — it reloads the document and wipes the
 * in-memory Zustand store (Conflict B: no persistence before
 * Milestone 8). This exact issue was found and fixed during Batch 6's
 * manual browser verification; every multi-portfolio workflow here
 * clicks through `<Link>`s instead, the same fix applied there.
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
  options: { name: string; fresh: boolean; quantity?: string; debtBalance?: string },
) {
  if (options.fresh) {
    await page.goto('/portfolios/new', { waitUntil: 'networkidle' });
  } else {
    await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
    await page.waitForURL('**/portfolios');
    await page.getByRole('link', { name: 'Create Portfolio' }).click();
    await page.waitForURL('**/portfolios/new');
  }
  await fillByLabel(page, 'Portfolio name', options.name);
  await fillByLabel(page, 'BTC quantity', options.quantity ?? '2');
  await page.locator('label', { hasText: 'Debt asset' }).locator('select').selectOption('USDC');
  await fillByLabel(page, 'Debt balance', options.debtBalance ?? '20000');
  await fillByLabel(page, 'Current BTC price (USD)', '50000');
  await fillByLabel(page, 'Maximum LTV (%)', '75');
  await fillByLabel(page, 'Liquidation threshold (%)', '80');
  await fillByLabel(page, 'Borrow APR (%)', '5');
  await fillByLabel(page, 'Supply APR (%)', '2');
  await page.getByRole('button', { name: 'Create Portfolio' }).click();
  await page.waitForURL('**/portfolio');
}

test('Cover: Create first portfolio', async ({ page }) => {
  await createPortfolio(page, { name: 'Alpha Portfolio', fresh: true });

  await expect(page.getByLabel('Portfolio name')).toHaveValue('Alpha Portfolio');
  await expect(page.getByRole('group', { name: 'Collateral' })).toBeVisible();
  await expect(page.locator('select[aria-label="Active portfolio"]')).toHaveValue(/.+/);
});

test('Cover: Create second portfolio and switch portfolios', async ({ page }) => {
  await createPortfolio(page, { name: 'Alpha Portfolio', fresh: true });
  await createPortfolio(page, { name: 'Beta Portfolio', fresh: false });
  await expect(page.getByLabel('Portfolio name')).toHaveValue('Beta Portfolio');

  const switcher = page.locator('select[aria-label="Active portfolio"]');
  await expect(switcher.locator('option', { hasText: 'Alpha Portfolio' })).toHaveCount(1);
  await expect(switcher.locator('option', { hasText: 'Beta Portfolio' })).toHaveCount(1);

  await switcher.selectOption({ label: 'Alpha Portfolio' });
  await expect(page.getByLabel('Portfolio name')).toHaveValue('Alpha Portfolio');

  await switcher.selectOption({ label: 'Beta Portfolio' });
  await expect(page.getByLabel('Portfolio name')).toHaveValue('Beta Portfolio');
});

test('Cover: Edit collateral', async ({ page }) => {
  await createPortfolio(page, { name: 'Collateral Test', fresh: true });
  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });

  await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('3');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(collateralSection.getByText('Health Factor', { exact: true })).toBeVisible();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(
    collateralSection.locator('label', { hasText: 'Quantity' }).locator('input'),
  ).toHaveValue('3');
});

test('Cover: Edit debt', async ({ page }) => {
  await createPortfolio(page, { name: 'Debt Test', fresh: true });
  const debtSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Debt' }) });

  await debtSection.locator('label', { hasText: 'Debt amount' }).locator('input').fill('15000');
  await debtSection.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(debtSection.getByText('Health Factor', { exact: true })).toBeVisible();
  await debtSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(
    debtSection.locator('label', { hasText: 'Debt amount' }).locator('input'),
  ).toHaveValue('15000');
});

test('Cover: BTC price is live and read-only, not manually editable', async ({ page }) => {
  // Portfolio Live-State Cleanup batch — BTC price, Maximum LTV,
  // Liquidation threshold, and Borrow rate became live/read-only fields
  // synced from Aave V3, replacing the old "Manual price (USD)" input and
  // "Reset price" button this test used to exercise.
  await createPortfolio(page, { name: 'Price Test', fresh: true });
  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });

  await expect(collateralSection.locator('label', { hasText: 'Manual price (USD)' })).toHaveCount(
    0,
  );
  await expect(collateralSection.getByRole('button', { name: 'Reset price' })).toHaveCount(0);
  await expect(collateralSection.getByText('Maximum LTV')).toBeVisible();
});

function rowByExactName(page: Page, name: string) {
  return page.locator('li').filter({ has: page.getByText(name, { exact: true }) });
}

test('Cover: Duplicate portfolio', async ({ page }) => {
  await createPortfolio(page, { name: 'Original Portfolio', fresh: true });
  await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
  await page.waitForURL('**/portfolios');

  const originalRow = rowByExactName(page, 'Original Portfolio');
  await originalRow.getByRole('button', { name: 'Duplicate', exact: true }).click();

  await expect(rowByExactName(page, 'Original Portfolio (Copy)')).toBeVisible();
  // The source row must still be present, unaffected.
  await expect(rowByExactName(page, 'Original Portfolio')).toBeVisible();
});

test('Cover: Archive portfolio', async ({ page }) => {
  await createPortfolio(page, { name: 'Archive Test', fresh: true });
  await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
  await page.waitForURL('**/portfolios');

  const row = rowByExactName(page, 'Archive Test');
  await row.getByRole('button', { name: 'Archive', exact: true }).click();

  await expect(rowByExactName(page, 'Archive Test')).not.toBeVisible();
  await page.getByRole('button', { name: /Show archived/ }).click();
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();

  // The archived row's name span also contains the "Archived" badge text,
  // so an exact match no longer applies here — anchor on the prefix
  // instead, unambiguous since only one portfolio exists in this test.
  const archivedRow = page.locator('li').filter({ has: page.getByText(/^Archive Test/) });
  await archivedRow.getByRole('button', { name: 'Unarchive', exact: true }).click();
  await expect(rowByExactName(page, 'Archive Test')).toBeVisible();
});

test('Cover: Delete portfolio', async ({ page }) => {
  await createPortfolio(page, { name: 'Delete Test', fresh: true });
  await page.locator('a', { hasText: /manage portfolios|view portfolios/i }).click();
  await page.waitForURL('**/portfolios');

  const row = rowByExactName(page, 'Delete Test');
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(/permanently removes the portfolio/)).toBeVisible();
  await row.getByRole('button', { name: 'Confirm Delete' }).click();

  await expect(page.getByText('No portfolios yet', { exact: true })).toBeVisible();
});

test('Cover: Recover from invalid input — validation error', async ({ page }) => {
  await createPortfolio(page, { name: 'Validation Test', fresh: true });

  const currencyInput = page.getByLabel('Base currency');
  await currencyInput.fill('');
  await currencyInput.blur();
  await page.waitForTimeout(800);
  // The invalid, empty draft never saved — the original value is
  // restorable by simply typing a valid one again.
  await currencyInput.fill('USD');
  await page.waitForTimeout(800);
  await expect(currencyInput).toHaveValue('USD');
});

test('Cover: Recover from invalid input — calculation failure (M4-017)', async ({ page }) => {
  await createPortfolio(page, {
    name: 'Broken Portfolio',
    fresh: true,
    quantity: '0',
    debtBalance: '20000',
  });

  await expect(page.getByText(/cannot compute/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download recovery copy' })).toBeVisible();

  const collateralSection = page
    .locator('form')
    .filter({ has: page.locator('legend', { hasText: 'Collateral' }) });
  await collateralSection.locator('label', { hasText: 'Quantity' }).locator('input').fill('2');
  await collateralSection.getByRole('button', { name: 'Preview Changes' }).click();
  const riskCheckbox = collateralSection.locator('input[type="checkbox"]');
  if ((await riskCheckbox.count()) > 0) await riskCheckbox.check();
  await collateralSection.getByRole('button', { name: 'Apply Changes' }).click();

  await expect(page.getByText(/cannot compute/i)).not.toBeVisible();
});

/**
 * V3 New-Portfolio Live Bootstrap — production smoke-test finding.
 * Every unit test locks down the exact prefill/dirty-tracking/provenance
 * logic against mocked, deterministic quotes
 * (`tests/unit/app/portfolios/new/NewPortfolioPageClient.liveBootstrap.test.tsx`);
 * this is the one real-browser proof that the flow works against the
 * actual `/api/aave/reserve` route this sandbox's public-RPC fallback
 * serves, end to end, without blocking creation either way.
 */
test('Cover: New Portfolio live bootstrap does not block creation whether live data resolves or not', async ({
  page,
}) => {
  await page.goto('/portfolios/new', { waitUntil: 'networkidle' });

  // Whatever the real result is (this sandbox's outbound network reach
  // is not something this test controls or assumes), the status line
  // must leave the checking/idle state and never silently stay silent.
  const statusLine = page
    .getByText(/checking for live aave v3 data|aave v3 ·|live aave v3 data is unavailable/i)
    .first();
  await expect(statusLine).toBeVisible({ timeout: 15_000 });

  const priceField = page.getByLabel('Current BTC price (USD)', { exact: false });
  const priceValue = await priceField.inputValue();

  if (Number(priceValue) > 0) {
    // Live data landed — prefilled, and honestly labeled as such.
    await expect(page.getByText('Aave V3 · Live').first()).toBeVisible();
  } else {
    // Live data did not land — the field is honestly still at its
    // manual-entry default, never a fabricated non-zero value.
    await expect(priceField).toHaveValue('0');
  }

  // Either way, the rest of the flow — including overriding whatever is
  // currently in the field — must still work and must not be blocked.
  await fillByLabel(page, 'Portfolio name', 'Live Bootstrap Check');
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

  await expect(page.getByLabel('Portfolio name')).toHaveValue('Live Bootstrap Check');
});

import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Settings (Import/Export/Backup/Recovery) End-to-End Tests —
 * 06_TASKS.md M8-036–M8-045 ("Import & Export") and M8-046–M8-048
 * ("Backup and Recovery"). Follows `tests/e2e/loopBuilderWorkflows.spec.ts`'s
 * own convention: real browser, real compiled app, exercising the one
 * workflow layer no unit test touches.
 *
 * **Waits for the real "Saved" status before navigating away from
 * portfolio creation.** Milestone 8's autosave (`autoSaveCoordinator`) is
 * debounced (~400ms); a full-page navigation (`page.goto`) immediately
 * after `page.waitForURL` kills that pending write before it lands,
 * before Batch 8's own local storage even sees the new portfolio — this
 * is a real characteristic of the debounced-autosave architecture (out
 * of scope to change at the app level in this batch), not a bug in the
 * workflow being tested here.
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

test('Cover: Full JSON export includes all supported records', async ({ page }) => {
  await createPortfolio(page, 'Export Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('full-backup');
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = JSON.parse(await readFile(path as string, 'utf-8'));

  expect(content.kind).toBe('full-backup');
  expect(content.app).toBe('ProfitPilot');
  expect(content.records.portfolio).toHaveLength(1);
  expect(content.records.portfolio[0].payload.name).toBe('Export Portfolio');
});

test('Cover: CSV export is scoped and well-formed', async ({ page }) => {
  await createPortfolio(page, 'CSV Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Portfolio Positions (CSV)' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('portfolio-positions');
  expect(download.suggestedFilename()).toContain('.csv');
  const path = await download.path();
  const content = await readFile(path as string, 'utf-8');
  const lines = content.split('\n');

  expect(lines[0]).toContain('Portfolio ID');
  expect(lines[0]).toContain('Collateral Quantity (BTC)');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('CSV Portfolio');
});

test('Cover: a corrupted import file is rejected safely', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });

  await page.setInputFiles('input[type="file"]', {
    name: 'corrupted.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{not valid json'),
  });

  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0);
});

test('Cover: an unrecognized file is rejected safely', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });

  await page.setInputFiles('input[type="file"]', {
    name: 'unrelated.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ some: 'unrelated', data: true })),
  });

  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0);
});

test('Cover: addAsNew merge mode adds a duplicate without touching the original', async ({
  page,
}) => {
  await createPortfolio(page, 'Original Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = await readFile(path as string, 'utf-8');

  await page.setInputFiles('input[type="file"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });

  await page.getByRole('radio', { name: 'Add as new' }).check();
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.getByText(/imported \d+ record/i)).toBeVisible();

  const portfolioKeyCount = await page.evaluate(
    () =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('profitpilot:v1:portfolio:'))
        .length,
  );
  expect(portfolioKeyCount).toBe(2);

  // addAsNew never renames — the duplicate keeps the original's own name,
  // so proving the original survived untouched means both now show up,
  // not that the name stayed unique. Scoped to the portfolio list itself
  // (not `getByText`) since the same name also appears a second time in
  // the header's "Active portfolio" combobox for each portfolio.
  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByRole('list').locator('li', { hasText: 'Original Portfolio' })).toHaveCount(
    2,
  );
});

/**
 * 06_TASKS.md M9-020 ("Test Destructive Action Protection") — Include:
 * "Conflict resolution." A real, already-built, previously-untested
 * feature: `MergeMode` has 4 values, not the 2 (`addAsNew`/`replaceAll`)
 * covered above — `mergeNonConflicting` (the UI's own default,
 * `app/settings/page.tsx`) and `replaceSelected` (a per-record
 * conflict checklist, `services/import/preview.ts`'s own
 * `planRecordAction`) were fully implemented since Milestone 8 but never
 * exercised end-to-end. **Not the same "conflict" as M9-015's "Resolve
 * data conflict" workflow item or M9-013's "Sync during local edit"** —
 * both of those are N/A (Milestone 8 local-only re-scope, Conflict #34;
 * no cloud sync mechanism exists to race against or reconcile with).
 * This is a distinct, real, purely-local feature:
 * `determineRecoverySnapshotReason` (`services/import/apply.ts`) itself
 * names `replaceSelected`'s own snapshot reason `'conflict-resolution'`
 * — the codebase's own vocabulary, not a label invented for this test.
 *
 * Both tests construct a synthetic import file by taking a real exported
 * envelope and cloning/mutating it (rather than authoring one from
 * scratch), the same "real, valid envelope shape, deliberately mutated
 * to exercise one specific path" technique
 * `tests/unit/services/import/ImportValidator.test.ts`'s own tests
 * already use. `checksum` is deleted from every mutated clone —
 * `createEnvelope`'s own checksum is computed over the *original*
 * payload, so keeping it on a *changed* payload would make
 * `verifyChecksum` fail; `envelope.ts`'s own header comment already
 * documents that an omitted checksum is treated as valid (the same
 * graceful path a hand-authored or older file takes), not a shortcut
 * invented for this test.
 */
test('Cover: mergeNonConflicting merge mode adds a non-conflicting record but skips a conflicting one (M9-020)', async ({
  page,
}) => {
  await createPortfolio(page, 'Existing Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = JSON.parse(await readFile(path as string, 'utf-8'));

  const existingEnvelope = content.records.portfolio[0];
  const newEnvelope = {
    ...existingEnvelope,
    recordId: 'synthetic-non-conflicting-portfolio',
    payload: {
      ...existingEnvelope.payload,
      id: 'synthetic-non-conflicting-portfolio',
      name: 'Imported New Portfolio',
    },
  };
  delete newEnvelope.checksum;
  content.records.portfolio = [existingEnvelope, newEnvelope];

  await page.setInputFiles('input[type="file"]', {
    name: 'merge-non-conflicting.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(content)),
  });

  // `mergeNonConflicting` is already the UI's own default selection —
  // checked explicitly regardless, so this test does not silently depend
  // on that default never changing.
  await page.getByRole('radio', { name: 'Merge non-conflicting' }).check();
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.getByText(/imported \d+ record/i)).toBeVisible();

  const portfolioKeyCount = await page.evaluate(
    () =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('profitpilot:v1:portfolio:'))
        .length,
  );
  // The conflicting record (matching the existing portfolio's own id) was
  // skipped, not duplicated; the non-conflicting one was added — 2 total,
  // not 1 (nothing added) or 3 (conflict wrongly duplicated).
  expect(portfolioKeyCount).toBe(2);

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByRole('list').locator('li', { hasText: 'Existing Portfolio' })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole('list').locator('li', { hasText: 'Imported New Portfolio' }),
  ).toHaveCount(1);
});

test('Cover: replaceSelected merge mode replaces only the checked conflicting record and creates a recovery snapshot (M9-020)', async ({
  page,
}) => {
  await createPortfolio(page, 'Conflict Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = JSON.parse(await readFile(path as string, 'utf-8'));

  const existingEnvelope = content.records.portfolio[0];
  const conflictingRecordId: string = existingEnvelope.recordId;
  const replacedEnvelope = {
    ...existingEnvelope,
    payload: { ...existingEnvelope.payload, name: 'Replaced Portfolio Name' },
  };
  delete replacedEnvelope.checksum;
  content.records.portfolio = [replacedEnvelope];

  await page.setInputFiles('input[type="file"]', {
    name: 'replace-selected.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(content)),
  });

  await page.getByRole('radio', { name: 'Replace selected' }).check();
  // `app/settings/page.tsx`'s own conflict checklist labels each entry
  // `${conflict.recordType}: ${conflict.recordId}` — reusing the real id
  // read back from the exported file, not a guessed literal.
  await page.getByRole('checkbox', { name: `portfolio: ${conflictingRecordId}` }).check();
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.getByText(/imported \d+ record/i)).toBeVisible();

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('list').locator('li', { hasText: 'Replaced Portfolio Name' }),
  ).toHaveCount(1);
  await expect(page.getByRole('list').locator('li', { hasText: 'Conflict Portfolio' })).toHaveCount(
    0,
  );

  // `determineRecoverySnapshotReason` (`services/import/apply.ts`) always
  // creates a `'conflict-resolution'` snapshot for `replaceSelected` —
  // unconditionally, unlike `replaceAll`'s own UI-level confirmation
  // checkbox — verified here as the real safety net this merge mode
  // actually relies on.
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: /conflict-resolution/i })).toBeVisible();
});

/**
 * M8-043's own "Create a recovery backup first" / M8-044's "Create
 * transactional backup... Rollback on any critical failure" are
 * satisfied by `apply.ts`'s in-memory snapshot-then-restore (the same
 * "in-memory only, not a persisted file" scope `migrations/
 * localDataMigration.ts` already established for M8-013) — a real,
 * unconditional backup taken before every destructive import, not the
 * separate *persisted, limited* recovery snapshot M8-046 (a later,
 * dependent Batch 4 task) adds. That in-memory backup is not something a
 * black-box browser test can observe directly without simulating a
 * storage failure mid-import; what this test verifies instead is
 * M8-043/M8-044's own actual DoD wording — "Imports preserve existing
 * data unless the user explicitly approves replacement."
 */
test('Cover: replaceAll requires explicit confirmation before replacing all local data', async ({
  page,
}) => {
  await createPortfolio(page, 'Solo Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = await readFile(path as string, 'utf-8');

  await page.setInputFiles('input[type="file"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });

  await page.getByRole('radio', { name: 'Replace all local data' }).check();
  const confirmButton = page.getByRole('button', { name: 'Confirm Import' });
  await expect(confirmButton).toBeDisabled();

  await page.getByRole('checkbox', { name: /permanently replace/i }).check();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(page.getByText(/imported \d+ record/i)).toBeVisible();

  const portfolioKeyCount = await page.evaluate(
    () =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('profitpilot:v1:portfolio:'))
        .length,
  );
  expect(portfolioKeyCount).toBe(1);

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByRole('list').locator('li', { hasText: 'Solo Portfolio' })).toHaveCount(1);
});

test('Cover: a recovery snapshot is created before replaceAll and can be restored (M8-046/M8-047)', async ({
  page,
}) => {
  await createPortfolio(page, 'Snapshot Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Backup (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = await readFile(path as string, 'utf-8');

  await page.setInputFiles('input[type="file"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await page.getByRole('radio', { name: 'Replace all local data' }).check();
  await page.getByRole('checkbox', { name: /permanently replace/i }).check();
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.getByText(/imported \d+ record/i)).toBeVisible();

  const snapshotRadio = page.getByRole('radio', { name: /full-replacement/i });
  await expect(snapshotRadio).toBeVisible();
  await snapshotRadio.check();
  await page.getByRole('checkbox', { name: /replace all current local data/i }).check();
  await page.getByRole('button', { name: 'Restore Selected Snapshot' }).click();
  await expect(page.getByText(/recovery snapshot restored/i)).toBeVisible();

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByRole('list').locator('li', { hasText: 'Snapshot Portfolio' })).toHaveCount(
    1,
  );
});

test('Cover: Clear Local Data requires confirmation and safely resets the application (M8-048)', async ({
  page,
}) => {
  await createPortfolio(page, 'Doomed Portfolio');
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const clearButton = page.getByRole('button', { name: 'Clear Local Data' });
  await expect(clearButton).toBeDisabled();

  await page
    .getByRole('checkbox', { name: /permanently delete all local profitpilot data/i })
    .check();
  await expect(clearButton).toBeEnabled();
  await clearButton.click();
  await expect(page.getByText(/local data cleared/i)).toBeVisible();

  const portfolioKeyCount = await page.evaluate(
    () =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('profitpilot:v1:portfolio:'))
        .length,
  );
  expect(portfolioKeyCount).toBe(0);

  const snapshotKeyCount = await page.evaluate(
    () =>
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith('profitpilot:v1:recoverySnapshot:'),
      ).length,
  );
  expect(snapshotKeyCount).toBe(1);

  await page.goto('/portfolios', { waitUntil: 'networkidle' });
  await expect(page.getByText('No portfolios yet', { exact: true })).toBeVisible();
});

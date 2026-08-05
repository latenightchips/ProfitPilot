import { expect, test } from '@playwright/test';

/**
 * Authentication End-to-End Tests — 06_TASKS.md M8-014–M8-021
 * ("Authentication"). This sandbox has no real Supabase project
 * configured (no `SUPABASE_URL`/`SUPABASE_ANON_KEY`, no `supabase` CLI,
 * no reachable local emulator — verified before this batch began; see
 * `services/auth/supabaseClient.ts`'s own header comment). Every test
 * below therefore exercises the REAL, honest "Supabase not configured"
 * graceful-degradation path this build actually takes in this
 * environment — not a fabrication, and not a substitute for testing
 * against a live backend. There is no test here claiming a successful
 * sign-up/sign-in/password-reset against a real account, because no such
 * thing can happen in this sandbox.
 */

test('Cover: anonymous/manual mode remains fully functional with no account (M8-021)', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // The header shows an optional Sign In link, never a login wall.
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('Cover: the header Sign In link reaches a working sign-in page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(/local data on this device is never changed/i)).toBeVisible();
});

test('Cover: sign-in gracefully reports that cloud accounts are unavailable in this environment', async ({
  page,
}) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(/not available in this environment/i);
});

test('Cover: sign-up explains accounts are optional and gracefully reports unavailability', async ({
  page,
}) => {
  await page.goto('/sign-up', { waitUntil: 'networkidle' });
  await expect(page.getByText(/entirely optional/i)).toBeVisible();
  await expect(page.getByText(/sync your data across devices/i)).toBeVisible();

  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(/not available in this environment/i);
});

test('Cover: sign-up rejects mismatched passwords before ever calling the Service', async ({
  page,
}) => {
  await page.goto('/sign-up', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password').fill('different456');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(/do not match/i);
});

test('Cover: password reset request gracefully reports unavailability', async ({ page }) => {
  await page.goto('/reset-password', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(/not available in this environment/i);
});

test('Cover: Settings shows the Account section with Sign In / Create Account and optional-account messaging', async ({
  page,
}) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const accountSection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Account' }),
  });
  await expect(accountSection.getByText(/accounts are optional/i)).toBeVisible();
  await expect(accountSection.getByRole('link', { name: 'Sign In', exact: true })).toHaveAttribute(
    'href',
    '/sign-in',
  );
  await expect(
    accountSection.getByRole('link', { name: 'Create Account', exact: true }),
  ).toHaveAttribute('href', '/sign-up');
});

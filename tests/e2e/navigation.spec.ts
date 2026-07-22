import { expect, test } from '@playwright/test';

test('dashboard is the default landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('sidebar links navigate to each primary page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Portfolio' }).click();
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
});

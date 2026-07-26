import { expect, test } from '@playwright/test';

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

import { expect, test } from '@playwright/test';

/**
 * Production smoke gate — R1-3 ("Runtime Pinning + Production CI Smoke
 * Gate"). Closes the R1-1 finding that CI never verified the actual
 * *built* application boots and serves anything — `pnpm build`
 * succeeding only proves the code compiles, not that `pnpm start`
 * produces a working server. `.github/workflows/ci.yml` runs this one
 * file (not the full suite below) against a real `pnpm build && pnpm
 * start` process, via this same `playwright.config.ts`'s own
 * `webServer` block — no second E2E framework, no hand-rolled
 * start/wait/kill logic: Playwright's `webServer` already provides
 * bounded startup waiting (see `webServer.timeout` below), a
 * deterministic failure if the server never becomes ready, and
 * guaranteed process cleanup after the run, whether tests pass or fail.
 *
 * **Deliberately excluded from the broader `tests/e2e/` suite's normal
 * purpose.** Every other spec in this directory exercises a real user
 * workflow end-to-end; this one exists purely to prove the production
 * *process* is alive and wired correctly — the smallest useful gate,
 * not a second copy of the workflow suite. `pnpm test:e2e` (unchanged,
 * still not run in CI — see `docs/OPERATIONAL_RUNBOOK.md`'s "Known
 * operational limitations") remains the full, broader suite for manual
 * runs; this file is invoked explicitly by path in CI instead.
 *
 * **What this gate proves**: the production build actually starts, the
 * root route renders past hydration (not just a static shell), a second
 * real application page loads, and the `/api/aave/*` boundary — now
 * sitting behind R1-2's rate-limiting `middleware.ts` — is reachable
 * and returns a well-formed response without crashing the server.
 *
 * **What this gate deliberately does NOT prove**: that a live Aave RPC
 * call succeeds, that Supabase/Sentry/CoinGecko are reachable, or
 * anything about real network conditions — this file makes zero calls
 * to any external service. The one Aave API check below is a request
 * with query parameters removed on purpose, which
 * `app/api/aave/v4-position/route.ts` rejects with `400` before it ever
 * constructs an RPC client — this is deterministic, always the same
 * result, and never touches the network. Genuine RPC/ABI/decimals
 * verification against the real network already exists as its own
 * separate, non-blocking, scheduled workflow
 * (`.github/workflows/aave-v4-boundary.yml`) and stays that way.
 */
test('production server starts and the root route renders past hydration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('a second real application page loads', async ({ page }) => {
  await page.goto('/portfolios');
  await expect(page.getByRole('heading', { name: 'Portfolios' })).toBeVisible();
});

test('the /api/aave/* boundary is reachable and responds without a server crash — no live RPC call made', async ({
  request,
}) => {
  // No ?userAddress/?debtAsset — the route's own validation rejects this
  // before any RPC client is ever constructed
  // (`app/api/aave/v4-position/route.ts`'s `missingParamsResponse()`),
  // so this is a deterministic, network-free way to prove the route
  // (and the R1-2 rate-limit middleware sitting in front of it) are
  // both correctly wired in the real production build.
  const response = await request.get('/api/aave/v4-position');
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.errors?.[0]?.code).toBe('AAVE_V4_MISSING_QUERY_PARAMS');
});

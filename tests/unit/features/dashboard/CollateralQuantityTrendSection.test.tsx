import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { CollateralQuantityTrendSection } from '@/features/dashboard/components/CollateralQuantityTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `CollateralQuantityTrendSection` — v1.14.0 Batch 2 ("Dashboard Trend
 * Parity, Part 2"). Follows the exact same real-persistence-seeding
 * pattern `tests/unit/features/dashboard/CollateralValueTrendSection.test.tsx`
 * (v1.14.0 Batch 1) already established: seed real persisted
 * `'portfolioHistory'` records via `recordPortfolioHistoryEntry` (the
 * same default `persistenceService`/local-storage-backed singleton the
 * component itself reads through), rather than mocking the read.
 *
 * `collateral.quantity` is an always-required, non-null number for
 * every entry regardless of protocol version, and its unit ("BTC") is a
 * fixed literal, not per-entry — so there is no "no risk"/"not
 * available" branch and no asset-symbol variance to cover here, unlike
 * `DebtQuantityTrendSection.test.tsx`.
 */
function entry(
  overrides: Partial<PersistedPortfolioHistoryEntry> = {},
): PersistedPortfolioHistoryEntry {
  return {
    portfolioId: 'portfolio-1',
    protocolVersion: 'v3',
    createdAt: '2026-01-01T00:00:00.000Z',
    collateral: { quantity: 2, valueUsd: 100000 },
    debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
    marketPriceUsd: 50000,
    healthFactor: 4,
    liquidationPriceUsd: 12500,
    loanToValue: 0.2,
    leverage: 1.25,
    borrowApr: 0.05,
    supplyApr: 0.02,
    annualizedInterestCost: 1000,
    dataSource: 'manual',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('CollateralQuantityTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Collateral Quantity history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Collateral Quantity Trend')).toBeInTheDocument();
  });
});

describe('CollateralQuantityTrendSection — error state', () => {
  it('shows a load-failed message rather than crashing (malformed persisted record)', async () => {
    const { buildLocalStorageKey } =
      await import('@/services/persistence/adapters/localStorageKeys');
    window.localStorage.setItem(
      buildLocalStorageKey('portfolioHistory', 'corrupt-1'),
      JSON.stringify(
        createEnvelope('portfolioHistory', 'corrupt-1', { portfolioId: 'portfolio-1' }),
      ),
    );

    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('CollateralQuantityTrendSection — single entry state', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 BTC/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('CollateralQuantityTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ entries, clearly identified as a Collateral Quantity trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2.5, valueUsd: 125000 },
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Collateral Quantity trend');
    expect(screen.getByText('Collateral Quantity Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value (with the BTC unit) for every plotted point in the aria-label summary — never derived from USD value or price', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        // A deliberately different market price ($60,000) does not
        // change the plotted quantity — proves the value is read
        // directly from `collateral.quantity`, never back-calculated
        // from `valueUsd`/`marketPriceUsd`.
        collateral: { quantity: 2.5, valueUsd: 150000 },
        marketPriceUsd: 60000,
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2 BTC');
    expect(label).toContain('2.5 BTC');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 3, valueUsd: 150000 },
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 2 BTC`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 3 BTC`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2.5, valueUsd: 125000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 10, valueUsd: 500000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 12, valueUsd: 600000 },
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2 BTC');
    expect(label).toContain('2.5 BTC');
    expect(label).not.toContain('10 BTC');
    expect(label).not.toContain('12 BTC');
  });

  it('is identical for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        collateral: { quantity: 2, valueUsd: 100000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        collateral: { quantity: 2.5, valueUsd: 125000 },
      }),
    );
    render(
      <CollateralQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2 BTC');
    expect(label).toContain('2.5 BTC');
  });
});

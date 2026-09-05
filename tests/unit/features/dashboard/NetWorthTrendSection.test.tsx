import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { NetWorthTrendSection } from '@/features/dashboard/components/NetWorthTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `NetWorthTrendSection` — v1.10.0 Batch 1 ("Dashboard Trend Parity").
 * Follows the exact same real-persistence-seeding pattern
 * `tests/unit/features/dashboard/AnnualizedInterestCostTrendSection.test.tsx`
 * already established: seed real persisted `'portfolioHistory'` records
 * via `recordPortfolioHistoryEntry` (the same default
 * `persistenceService`/local-storage-backed singleton the component
 * itself reads through), rather than mocking the read.
 *
 * Like Interest Cost, `collateral.valueUsd`/`debt.valueUsd` are always
 * required, non-null numbers for every entry regardless of protocol
 * version, so there is no "no risk"/"not available" branch to cover
 * here — only plain derived numeric values.
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

describe('NetWorthTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Net Worth history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Net Worth Trend')).toBeInTheDocument();
  });
});

describe('NetWorthTrendSection — error state', () => {
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
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('NetWorthTrendSection — single usable point', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    // 100000 - 20000 = 80000
    await recordPortfolioHistoryEntry(
      entry({
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/\$80,000\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a negative net worth without clamping when debt exceeds collateral value', async () => {
    // 10000 - 20000 = -10000
    await recordPortfolioHistoryEntry(
      entry({
        collateral: { quantity: 0.2, valueUsd: 10000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/-\$10,000\.00/)).toBeInTheDocument();
  });
});

describe('NetWorthTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ entries, clearly identified as a Net Worth trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 120000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Net Worth trend');
    expect(screen.getByText('Net Worth Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value for every plotted point in the aria-label summary', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 120000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$100,000.00');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 150000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
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
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} $80,000.00`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} $130,000.00`;
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
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 2, valueUsd: 120000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        collateral: { quantity: 5, valueUsd: 500000 },
        debt: { asset: 'USDC', quantity: 50000, valueUsd: 50000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-02-01T00:00:00.000Z',
        collateral: { quantity: 5, valueUsd: 600000 },
        debt: { asset: 'USDC', quantity: 50000, valueUsd: 50000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$100,000.00');
    expect(label).not.toContain('$450,000.00');
    expect(label).not.toContain('$550,000.00');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v3',
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v3',
        collateral: { quantity: 2, valueUsd: 120000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$100,000.00');
  });

  it('is identical for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        collateral: { quantity: 2, valueUsd: 120000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <NetWorthTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$100,000.00');
  });
});

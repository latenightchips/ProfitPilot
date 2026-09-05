import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BorrowAprTrendSection } from '@/features/dashboard/components/BorrowAprTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `BorrowAprTrendSection` — v1.11.0 Batch 2 ("Borrow APR Trend
 * Completion"). Follows the exact same real-persistence-seeding pattern
 * `tests/unit/features/dashboard/LiquidationPriceTrendSection.test.tsx`
 * already established: seed real persisted `'portfolioHistory'` records
 * via `recordPortfolioHistoryEntry` (the same default
 * `persistenceService`/local-storage-backed singleton the component
 * itself reads through), rather than mocking the read.
 *
 * Unlike every prior sibling trend section, `borrowApr` is
 * `number | undefined` (never `null`) — `undefined` only for a V4
 * portfolio with no synced debt state yet (per
 * `services/persistence/types/models.ts`'s own doc comment) — and the
 * approved v1.11.0 convention (IMPLEMENTATION APPROVAL Decision 1) is
 * that an `undefined` observation renders "Not available," distinct
 * from `LiquidationPriceTrendSection`'s own "No liquidation risk" text.
 * This suite also covers the one respect in which this component's
 * chart-eligibility threshold differs from every prior sibling: it
 * requires two *usable* (non-`undefined`) observations, not merely two
 * persisted entries.
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

describe('BorrowAprTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Borrow APR history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Borrow APR Trend')).toBeInTheDocument();
  });
});

describe('BorrowAprTrendSection — error state', () => {
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
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('BorrowAprTrendSection — fewer than 2 usable observations', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    await recordPortfolioHistoryEntry(entry({ borrowApr: 0.05 }));
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/5%/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders "Not available" for a single undefined-borrowApr entry (V4, no synced debt state), never a fabricated 0% or NaN', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: undefined,
      }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Not available/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a chart for a V4 portfolio with no synced debt state, even with 2+ persisted entries, since none carry a usable borrowApr', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: undefined,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: undefined,
      }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Not available/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a chart with exactly one usable observation among several entries', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: undefined,
      }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Latest recorded entry (2026-02-01) has an undefined borrowApr.
    expect(screen.getByText(/Not available/)).toBeInTheDocument();
  });
});

describe('BorrowAprTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ usable entries, clearly identified as a Borrow APR trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', borrowApr: 0.06 }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Borrow APR trend');
    expect(screen.getByText('Borrow APR Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value for every plotted point in the aria-label summary', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', borrowApr: 0.06 }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('4%');
    expect(label).toContain('6%');
    expect(label).not.toContain('NaN');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', borrowApr: 0.08 }),
    );
    render(
      <BorrowAprTrendSection
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
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 4%`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 8%`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('renders "Not available" inside the aria-label for an undefined-borrowApr entry among a mixed valid/undefined history, preserving the surrounding valid observations rather than dropping or interpolating them', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: undefined,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-03-01T00:00:00.000Z', borrowApr: 0.09 }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('4%');
    expect(label).toContain('Not available');
    expect(label).toContain('9%');
    expect(label).not.toContain('0%');
    expect(label).not.toContain('NaN');
    // Chronological order preserved across the gap: 4% before "Not available" before 9%.
    expect(label.indexOf('4%')).toBeLessThan(label.indexOf('Not available'));
    expect(label.indexOf('Not available')).toBeLessThan(label.indexOf('9%'));
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-1', createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-1', createdAt: '2026-02-01T00:00:00.000Z', borrowApr: 0.06 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-2', createdAt: '2026-01-01T00:00:00.000Z', borrowApr: 0.4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-2', createdAt: '2026-02-01T00:00:00.000Z', borrowApr: 0.45 }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('4%');
    expect(label).toContain('6%');
    expect(label).not.toContain('40%');
    expect(label).not.toContain('45%');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', borrowApr: 0.04 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', protocolVersion: 'v3', borrowApr: 0.06 }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('4%');
    expect(label).toContain('6%');
  });

  it('is identical for a V4 portfolio entry with synced debt state (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: 0.04,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        borrowApr: 0.06,
      }),
    );
    render(
      <BorrowAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('4%');
    expect(label).toContain('6%');
  });
});

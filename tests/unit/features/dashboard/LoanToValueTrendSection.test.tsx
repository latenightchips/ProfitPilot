import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoanToValueTrendSection } from '@/features/dashboard/components/LoanToValueTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `LoanToValueTrendSection` — v1.10.0 Batch 1 ("Dashboard Trend
 * Parity"). Follows the exact same real-persistence-seeding pattern
 * `tests/unit/features/dashboard/AnnualizedInterestCostTrendSection.test.tsx`
 * already established: seed real persisted `'portfolioHistory'` records
 * via `recordPortfolioHistoryEntry` (the same default
 * `persistenceService`/local-storage-backed singleton the component
 * itself reads through), rather than mocking the read.
 *
 * Like Interest Cost, `loanToValue` is always a required, non-null
 * number for every entry regardless of protocol version, so there is no
 * "no risk"/"not available" branch to cover here — only plain numeric
 * values.
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

describe('LoanToValueTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Loan-to-Value history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Loan-to-Value Trend')).toBeInTheDocument();
  });
});

describe('LoanToValueTrendSection — error state', () => {
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
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('LoanToValueTrendSection — single usable point', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    await recordPortfolioHistoryEntry(entry({ loanToValue: 0.2 }));
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/20%/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('LoanToValueTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ entries, clearly identified as a Loan-to-Value trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', loanToValue: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', loanToValue: 0.35 }),
    );
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Loan-to-Value trend');
    expect(screen.getByText('Loan-to-Value Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value for every plotted point in the aria-label summary', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', loanToValue: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', loanToValue: 0.35 }),
    );
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20%');
    expect(label).toContain('35%');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', loanToValue: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', loanToValue: 0.5 }),
    );
    render(
      <LoanToValueTrendSection
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
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 20%`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 50%`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        loanToValue: 0.2,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-02-01T00:00:00.000Z',
        loanToValue: 0.3,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        loanToValue: 0.6,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-02-01T00:00:00.000Z',
        loanToValue: 0.7,
      }),
    );
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20%');
    expect(label).toContain('30%');
    expect(label).not.toContain('60%');
    expect(label).not.toContain('70%');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', loanToValue: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', protocolVersion: 'v3', loanToValue: 0.35 }),
    );
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20%');
    expect(label).toContain('35%');
  });

  it('is identical for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        loanToValue: 0.2,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        loanToValue: 0.35,
      }),
    );
    render(
      <LoanToValueTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20%');
    expect(label).toContain('35%');
  });
});

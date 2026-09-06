import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DebtQuantityTrendSection } from '@/features/dashboard/components/DebtQuantityTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `DebtQuantityTrendSection` — v1.14.0 Batch 2 ("Dashboard Trend
 * Parity, Part 2"). Follows the exact same real-persistence-seeding
 * pattern `tests/unit/features/dashboard/DebtValueTrendSection.test.tsx`
 * (v1.14.0 Batch 1) already established: seed real persisted
 * `'portfolioHistory'` records via `recordPortfolioHistoryEntry` (the
 * same default `persistenceService`/local-storage-backed singleton the
 * component itself reads through), rather than mocking the read.
 *
 * `debt.quantity` is an always-required, non-null number for every
 * entry regardless of protocol version — but unlike collateral, its
 * unit (`debt.asset`) is a free `string`, not a fixed literal, and can
 * genuinely differ between snapshots of the same portfolio
 * (`app/portfolio/PortfolioHistoryPanel.tsx`'s own `debtQuantity`
 * metric, v1.12.0 Batch 3, already established and tested this). The
 * "debt asset changed between snapshots" coverage below is this file's
 * distinguishing scenario, absent from `CollateralQuantityTrendSection.test.tsx`.
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

describe('DebtQuantityTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Debt Quantity history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Debt Quantity Trend')).toBeInTheDocument();
  });
});

describe('DebtQuantityTrendSection — error state', () => {
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
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('DebtQuantityTrendSection — single entry state', () => {
  it('shows the single value as text, with its own asset symbol, rather than a one-point chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/20,000 USDC/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a zero debt quantity without special-casing (never treated as null/unavailable)', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/0 USDC/)).toBeInTheDocument();
  });
});

describe('DebtQuantityTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ entries, clearly identified as a Debt Quantity trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Debt Quantity trend');
    expect(screen.getByText('Debt Quantity Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value (with its own asset symbol) for every plotted point in the aria-label summary — never derived from USD value or price', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        // A deliberately different market price does not change the
        // plotted quantity — proves the value is read directly from
        // `debt.quantity`, never back-calculated from `valueUsd`/
        // `marketPriceUsd`.
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
        marketPriceUsd: 60000,
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('25,000 USDC');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 30000, valueUsd: 30000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
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
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 20,000 USDC`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 30,000 USDC`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 50000, valueUsd: 50000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 60000, valueUsd: 60000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('25,000 USDC');
    expect(label).not.toContain('50,000 USDC');
    expect(label).not.toContain('60,000 USDC');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v3',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v3',
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('25,000 USDC');
  });

  it('is identical for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('25,000 USDC');
  });
});

describe('DebtQuantityTrendSection — debt asset changes between historical snapshots', () => {
  it('shows each point with its own real asset symbol in the accessible summary, never a merged or fabricated unit', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        // The portfolio's borrowed asset genuinely changed between
        // snapshots — the second point must carry its own "DAI" symbol,
        // not "USDC" carried over from the first.
        debt: { asset: 'DAI', quantity: 15000, valueUsd: 15000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('15,000 DAI');
    // Never a wrong cross-pairing of quantity and asset.
    expect(label).not.toContain('20,000 DAI');
    expect(label).not.toContain('15,000 USDC');
  });

  it('renders the chart without crashing when three snapshots each use a different debt asset', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'DAI', quantity: 15000, valueUsd: 15000 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-03-01T00:00:00.000Z',
        debt: { asset: 'USDT', quantity: 18000, valueUsd: 18000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('20,000 USDC');
    expect(label).toContain('15,000 DAI');
    expect(label).toContain('18,000 USDT');
  });

  it('uses the most recent entry’s own asset symbol for the single-entry state after an asset change (no earlier history exists to describe there)', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        debt: { asset: 'DAI', quantity: 15000, valueUsd: 15000 },
      }),
    );
    render(
      <DebtQuantityTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/15,000 DAI/)).toBeInTheDocument();
  });
});

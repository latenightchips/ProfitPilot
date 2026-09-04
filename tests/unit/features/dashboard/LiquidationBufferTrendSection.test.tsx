import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LiquidationBufferTrendSection } from '@/features/dashboard/components/LiquidationBufferTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `LiquidationBufferTrendSection` — v1.8.0 Batch 1 ("Dashboard
 * Liquidation Buffer Trend Visibility"). Follows the exact same
 * real-persistence-seeding pattern
 * `tests/unit/features/dashboard/HealthFactorTrendSection.test.tsx`
 * already established: seed real persisted `'portfolioHistory'` records
 * via `recordPortfolioHistoryEntry` (the same default
 * `persistenceService`/local-storage-backed singleton the component
 * itself reads through), rather than mocking the read.
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

describe('LiquidationBufferTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Liquidation Buffer history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Liquidation Buffer Trend')).toBeInTheDocument();
  });
});

describe('LiquidationBufferTrendSection — error state', () => {
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
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('LiquidationBufferTrendSection — single usable point', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    // (50000-12500)/50000 = 0.75 -> 75%
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 50000, liquidationPriceUsd: 12500 }));
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders "No liquidation risk" for a single zero-debt (null liquidationPriceUsd) entry, never a fabricated 0% or NaN', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/No liquidation risk/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('renders "No liquidation risk" — never NaN/Infinity — for a single entry with an invalid market-price denominator, per the existing helper contract', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 0, liquidationPriceUsd: 12500 }));
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/No liquidation risk/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });
});

describe('LiquidationBufferTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ entries, clearly identified as a Liquidation Buffer trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 60000,
        liquidationPriceUsd: 30000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Liquidation Buffer trend');
    expect(screen.getByText('Liquidation Buffer Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible buffer value for every plotted point in the aria-label summary', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 60000,
        liquidationPriceUsd: 30000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    // (50000-12500)/50000 = 0.75 -> 75%; (60000-30000)/60000 = 0.5 -> 50%
    expect(label).toContain('75%');
    expect(label).toContain('50%');
  });

  it('renders a negative buffer without clamping when market price is below liquidation price', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      // (40000-50000)/40000 = -0.25 -> -25%
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 40000,
        liquidationPriceUsd: 50000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('-25%');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 25000,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 10000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    // Each point renders as "<formatted timestamp> <formatted value>" — the
    // formatted timestamp itself contains a comma, so reconstruct each
    // point's own exact expected substring rather than searching for a
    // lone digit/percent that could coincidentally also appear elsewhere.
    const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    // before: (50000-25000)/50000=0.5 -> 50%; after: (50000-10000)/50000=0.8 -> 80%
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 50%`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 80%`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('renders "No liquidation risk" inside the aria-label for a zero-debt entry among multiple, never dropping information into the visual line alone', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('No liquidation risk');
    expect(label).toContain('75%');
    expect(label).not.toContain('NaN');
    expect(label).not.toContain('Infinity');
  });

  it('renders "No liquidation risk" — never NaN/Infinity — for an invalid market-price denominator among multiple entries', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 0,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('No liquidation risk');
    expect(label).toContain('75%');
    expect(label).not.toContain('NaN');
    expect(label).not.toContain('Infinity');
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 10000,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 45000,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-02-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 40000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    // portfolio-1: 75%, 80%; portfolio-2: 10%, 20% — none of portfolio-2's
    // own values should leak into portfolio-1's summary.
    expect(label).toContain('75%');
    expect(label).toContain('80%');
    expect(label).not.toContain('10%');
    expect(label).not.toContain('20%');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v3',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v3',
        marketPriceUsd: 60000,
        liquidationPriceUsd: 30000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('75%');
    expect(label).toContain('50%');
  });

  it('is identical for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — never branches on protocol version', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        marketPriceUsd: 50000,
        liquidationPriceUsd: 12500,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        marketPriceUsd: 60000,
        liquidationPriceUsd: 30000,
      }),
    );
    render(
      <LiquidationBufferTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('75%');
    expect(label).toContain('50%');
  });
});

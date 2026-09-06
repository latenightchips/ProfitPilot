import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SupplyAprTrendSection } from '@/features/dashboard/components/SupplyAprTrendSection';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `SupplyAprTrendSection` — v1.14.0 Batch 3 ("Dashboard Trend Parity,
 * Part 2", final batch). Follows the exact same real-persistence-seeding
 * pattern `tests/unit/features/dashboard/BorrowAprTrendSection.test.tsx`
 * already established: seed real persisted `'portfolioHistory'` records
 * via `recordPortfolioHistoryEntry` (the same default
 * `persistenceService`/local-storage-backed singleton the component
 * itself reads through), rather than mocking the read.
 *
 * Like `borrowApr`, `supplyApr` is `number | undefined` (never `null`)
 * — but unlike `borrowApr`, `undefined` here means **"Not applicable,"
 * permanently, for every V4 entry** (per
 * `services/persistence/types/models.ts`'s own doc comment: "`undefined`
 * for every V4 portfolio, unconditionally"), never a pending-sync state
 * that could later resolve. This suite therefore covers a scenario
 * `BorrowAprTrendSection.test.tsx` has no equivalent for: a V4 entry
 * with `dataSource: 'live'` and other fields fully populated must still
 * show `supplyApr` as "Not applicable," proving the component never
 * invents a rate for V4 just because the rest of the entry looks
 * "synced." It also covers mixed V3/V4 history explicitly, confirming
 * each entry's own real protocol-tied value (or permanent absence) is
 * preserved truthfully, never merged, averaged, or carried across
 * protocol versions.
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

function v4Entry(
  overrides: Partial<PersistedPortfolioHistoryEntry> = {},
): PersistedPortfolioHistoryEntry {
  return entry({
    protocolVersion: 'v4',
    supplyApr: undefined,
    dataSource: 'live',
    ...overrides,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('SupplyAprTrendSection — empty state', () => {
  it('explains there is no history yet, rather than rendering an empty chart', async () => {
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('No Supply APR history yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Supply APR Trend')).toBeInTheDocument();
  });
});

describe('SupplyAprTrendSection — error state', () => {
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
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('History could not be loaded.')).toBeInTheDocument();
    });
  });
});

describe('SupplyAprTrendSection — fewer than 2 usable observations', () => {
  it('shows the single value as text rather than a one-point chart, never fabricating a second point', async () => {
    await recordPortfolioHistoryEntry(entry({ supplyApr: 0.02 }));
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2%/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders "Not applicable" for a single undefined-supplyApr entry (V4), never "Not available", a fabricated 0%, or NaN', async () => {
    await recordPortfolioHistoryEntry(v4Entry());
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
    expect(screen.queryByText(/Not available/)).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a chart for an all-V4 portfolio, even with 2+ persisted entries, since none carry a usable supplyApr', async () => {
    await recordPortfolioHistoryEntry(v4Entry({ createdAt: '2026-01-01T00:00:00.000Z' }));
    await recordPortfolioHistoryEntry(v4Entry({ createdAt: '2026-02-01T00:00:00.000Z' }));
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a chart with exactly one usable observation among mixed V3/V4 entries', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.03 }),
    );
    await recordPortfolioHistoryEntry(v4Entry({ createdAt: '2026-02-01T00:00:00.000Z' }));
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Latest recorded entry (2026-02-01, V4) has a permanently undefined supplyApr.
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
  });

  it('shows "Not applicable" even for a fully live-synced V4 entry — never invents a supply rate because the rest of the entry looks synced', async () => {
    await recordPortfolioHistoryEntry(
      v4Entry({
        borrowApr: 0.045,
        healthFactor: 3.2,
        liquidationPriceUsd: 15000,
      }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Not enough history yet to show a trend/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
  });
});

describe('SupplyAprTrendSection — multiple entries', () => {
  it('renders an accessible chart with 2+ usable entries, clearly identified as a Supply APR trend', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', supplyApr: 0.03 }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Supply APR trend');
    expect(screen.getByText('Supply APR Trend')).toBeInTheDocument();
  });

  it('states the exact displayed/accessible value for every plotted point in the aria-label summary — reads the persisted value directly, never recomputed from utilization or reserve data', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', supplyApr: 0.035 }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2%');
    expect(label).toContain('3.5%');
    expect(label).not.toContain('NaN');
  });

  it('preserves chronological ordering (oldest first) in the accessible summary, regardless of the service’s newest-first read order', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', supplyApr: 0.04 }),
    );
    render(
      <SupplyAprTrendSection
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
    const oldestPoint = `${dateTimeFormatter.format(new Date('2026-01-01T00:00:00.000Z'))} 2%`;
    const newestPoint = `${dateTimeFormatter.format(new Date('2026-02-01T00:00:00.000Z'))} 4%`;
    expect(label).toContain(oldestPoint);
    expect(label).toContain(newestPoint);
    expect(label.indexOf(oldestPoint)).toBeLessThan(label.indexOf(newestPoint));
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries feed the chart', async () => {
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-1', createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-1', createdAt: '2026-02-01T00:00:00.000Z', supplyApr: 0.03 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-2', createdAt: '2026-01-01T00:00:00.000Z', supplyApr: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'portfolio-2', createdAt: '2026-02-01T00:00:00.000Z', supplyApr: 0.25 }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2%');
    expect(label).toContain('3%');
    expect(label).not.toContain('20%');
    expect(label).not.toContain('25%');
  });

  it('works for a V3 portfolio entry (explicit protocolVersion "v3", the default in this codebase)', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.03 }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2%');
    expect(label).toContain('3%');
  });
});

describe('SupplyAprTrendSection — mixed V3/V4 history (protocol/version truthfulness)', () => {
  it('renders "Not applicable" inside the aria-label for a V4 entry among mixed V3/V4 history, preserving the surrounding real V3 observations rather than dropping, interpolating, or normalizing across protocol versions', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(v4Entry({ createdAt: '2026-02-01T00:00:00.000Z' }));
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-03-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.045 }),
    );
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2%');
    expect(label).toContain('Not applicable');
    expect(label).toContain('4.5%');
    expect(label).not.toContain('0%');
    expect(label).not.toContain('NaN');
    // Chronological order preserved across the V4 gap: 2% before "Not applicable" before 4.5%.
    expect(label.indexOf('2%')).toBeLessThan(label.indexOf('Not applicable'));
    expect(label.indexOf('Not applicable')).toBeLessThan(label.indexOf('4.5%'));
  });

  it('a portfolio that switched from V3 to V4 shows only its real V3-era Supply APR history, with the V4 era rendering as a truthful gap, not a continuation of the last V3 value', async () => {
    // A portfolio switching protocol versions (AaveProtocolVersionForm.tsx)
    // genuinely produces this shape: V3 entries with a real supplyApr,
    // followed by V4 entries with none.
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.02 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', protocolVersion: 'v3', supplyApr: 0.025 }),
    );
    await recordPortfolioHistoryEntry(v4Entry({ createdAt: '2026-03-01T00:00:00.000Z' }));
    render(
      <SupplyAprTrendSection
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const chart = await screen.findByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('2%');
    expect(label).toContain('2.5%');
    expect(label).toContain('Not applicable');
    // Never a fabricated repeat of the last real V3 value (2.5%) for the V4 point.
    expect(label.match(/2\.5%/g)?.length).toBe(1);
  });
});

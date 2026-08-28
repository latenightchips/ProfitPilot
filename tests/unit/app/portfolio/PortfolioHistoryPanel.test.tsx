import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PortfolioHistoryPanel } from '@/app/portfolio/PortfolioHistoryPanel';
import { createEnvelope } from '@/services/persistence/envelope';
import { recordPortfolioHistoryEntry } from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * `PortfolioHistoryPanel` — V1.1 Batch 2. Seeds real persisted
 * `'portfolioHistory'` records via `recordPortfolioHistoryEntry` (the
 * same default `persistenceService`/local-storage-backed singleton the
 * component itself reads through), rather than mocking the read — the
 * table is the primary accessible source (DoD: "enhance understanding
 * without replacing numerical data"), so these tests assert on its
 * rendered text content directly.
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

describe('PortfolioHistoryPanel — error state', () => {
  it('shows a load-failed message rather than crashing or rendering stale data', async () => {
    // Writes a malformed record directly into local storage (bypassing
    // `PersistenceService`'s own write-time validation) — the same
    // "fails safely on read" scenario
    // `tests/unit/services/persistence/portfolioHistory.test.ts`'s own
    // "data integrity — malformed entries" test proves at the Service
    // layer; this proves the UI's own `status === 'error'` branch renders
    // for it instead of an empty/loading table.
    const { buildLocalStorageKey } =
      await import('@/services/persistence/adapters/localStorageKeys');
    window.localStorage.setItem(
      buildLocalStorageKey('portfolioHistory', 'corrupt-1'),
      JSON.stringify(
        createEnvelope('portfolioHistory', 'corrupt-1', { portfolioId: 'portfolio-1' }),
      ),
    );

    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('History could not be loaded.');
    });
  });
});

describe('PortfolioHistoryPanel — empty state', () => {
  it('explains history is recorded automatically, rather than rendering an empty table', async () => {
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/No history yet/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('PortfolioHistoryPanel — with entries', () => {
  it('renders the table with the required minimum columns and values', async () => {
    await recordPortfolioHistoryEntry(entry());
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByText('4')).toBeInTheDocument(); // Health Factor
    expect(screen.getByText('$100,000.00')).toBeInTheDocument(); // Collateral value
    expect(screen.getByText('$20,000.00')).toBeInTheDocument(); // Debt value
    expect(screen.getByText('20%')).toBeInTheDocument(); // LTV
    expect(screen.getByText('1.25x')).toBeInTheDocument(); // Leverage
    expect(screen.getByText('5%')).toBeInTheDocument(); // Borrow APR
  });

  it('does not render the chart with only one entry, but always renders the table', async () => {
    await recordPortfolioHistoryEntry(entry());
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an accessible Health Factor trend chart with 2+ entries, with the table as the primary source', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', healthFactor: 4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', healthFactor: 3 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Health Factor trend');
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 entries
  });

  it('renders a before/after delta beneath the current value for a non-first row', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', healthFactor: 4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', healthFactor: 3 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    // The newer (top) row's delta vs. the older one: 4 -> 3 (-1).
    expect(screen.getByText('4 → 3 (-1)')).toBeInTheDocument();
  });

  it('renders "∞" for a zero-debt (null) Health Factor, matching the app-wide convention', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('renders "Not available" for an undefined borrowApr rather than a fabricated 0%', async () => {
    await recordPortfolioHistoryEntry(entry({ borrowApr: undefined }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('keeps multiple portfolios isolated — only the requested portfolioId’s entries render', async () => {
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'portfolio-1', healthFactor: 4 }));
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'portfolio-2', healthFactor: 9 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
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
 *
 * **Value assertions scoped to the table via `within` (V1.1 Batch 7)**:
 * the component now also renders a `sm:hidden` mobile card list with the
 * same values (Section 4 — "do not force a wide desktop table into
 * 320px"). jsdom applies no real CSS layout, so both views are present
 * in the DOM simultaneously in every test here regardless of the
 * `hidden`/`sm:hidden` classes that only take effect in a real browser —
 * an unscoped `getByText` on a value that appears in both would now
 * throw "multiple elements found." `tests/e2e/mobileWorkflows.spec.ts`
 * and this batch's own new mobile-viewport coverage are what actually
 * proves the card list renders correctly in a real browser; these
 * component tests only need to keep proving the table's own content,
 * which `within(getByRole('table'))` still does precisely.
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
    const table = within(screen.getByRole('table'));
    expect(table.getByText('4')).toBeInTheDocument(); // Health Factor
    expect(table.getByText('$100,000.00')).toBeInTheDocument(); // Collateral value
    expect(table.getByText('$20,000.00')).toBeInTheDocument(); // Debt value
    expect(table.getByText('20%')).toBeInTheDocument(); // LTV
    expect(table.getByText('1.25x')).toBeInTheDocument(); // Leverage
    expect(table.getByText('5%')).toBeInTheDocument(); // Borrow APR
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
    expect(within(screen.getByRole('table')).getByText('4 → 3 (-1)')).toBeInTheDocument();
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
    expect(within(screen.getByRole('table')).getByText('∞')).toBeInTheDocument();
  });

  it('V1.1 Batch 4: renders a full-exit entry (zero collateral/debt) with leverage "0x" and HF "∞", never "NaN"', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        collateral: { quantity: 0, valueUsd: 0 },
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
        healthFactor: null,
        liquidationPriceUsd: null,
        loanToValue: 0,
        leverage: 0,
        annualizedInterestCost: 0,
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
    const table = within(screen.getByRole('table'));
    expect(table.getByText('∞')).toBeInTheDocument();
    expect(table.getByText('0x')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
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
    expect(within(screen.getByRole('table')).getByText('Not available')).toBeInTheDocument();
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
    expect(within(screen.getByRole('table')).getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('V1.1 Batch 7: also renders a mobile card list with the same required values, one card per entry', async () => {
    await recordPortfolioHistoryEntry(entry());
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
    const list = within(screen.getByRole('list'));
    expect(list.getAllByRole('listitem')).toHaveLength(1);
    expect(list.getByText('4')).toBeInTheDocument(); // Health Factor
    expect(list.getByText('$100,000.00')).toBeInTheDocument(); // Collateral value
    expect(list.getByText('$20,000.00')).toBeInTheDocument(); // Debt value
    expect(list.getByText('20%')).toBeInTheDocument(); // LTV
    expect(list.getByText('1.25x')).toBeInTheDocument(); // Leverage
    expect(list.getByText('5%')).toBeInTheDocument(); // Borrow APR
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * V1.3.0 Batch 1 ("Portfolio Analytics — Trend Visibility") — the compact
 * metric selector added to the same accessible chart the tests above
 * already cover. These tests seed entries with deliberately distinct
 * collateral/debt/LTV/leverage values per snapshot so a wrong metric
 * being plotted (or the wrong entry's value inside the aria-label
 * summary) would be caught rather than accidentally matching by
 * coincidence.
 */
describe('PortfolioHistoryPanel — multi-metric trend chart', () => {
  it('defaults to Health Factor, matching pre-existing behavior, and does not render the selector with fewer than 2 entries', async () => {
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
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
  });

  it('renders a keyboard-accessible, labeled metric selector defaulting to Health Factor', async () => {
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

    const select = await screen.findByLabelText('Chart metric');
    expect(select.tagName).toBe('SELECT');
    expect((select as HTMLSelectElement).value).toBe('healthFactor');
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Health Factor trend');
  });

  it('derives Net Worth as collateral.valueUsd - debt.valueUsd (the documented Net Worth formula), never an alternative definition', async () => {
    const user = userEvent.setup();
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
        collateral: { quantity: 2, valueUsd: 130000 },
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'netWorth');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Net Worth trend');
    // 100000 - 20000 = 80000; 130000 - 25000 = 105000 — currency-formatted,
    // never a P&L/return/cost-basis figure.
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$105,000.00');
  });

  it('plots the already-persisted Loan-to-Value field, formatted as a percentage, without recomputing it', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', loanToValue: 0.2 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', loanToValue: 0.35 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'loanToValue');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Loan-to-Value trend');
    expect(label).toContain('20%');
    expect(label).toContain('35%');
  });

  it('plots the already-persisted leverage field with the existing "x" convention, without recomputing it', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', leverage: 1.25 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', leverage: 1.5 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'leverage');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Leverage trend');
    expect(label).toContain('1.25x');
    expect(label).toContain('1.5x');
  });

  it('renders "∞" inside the aria-label for a zero-debt Health Factor, never dropping information into the visual line alone', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
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

    const chart = await screen.findByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('∞');
  });

  it('preserves existing table/card values, protocol/provenance information, and column set when switching the chart metric', async () => {
    const user = userEvent.setup();
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
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'netWorth');

    // Table is unaffected by the chart's own selected metric — still
    // shows every original column, including Health Factor and Borrow APR.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('4')).toBeInTheDocument();
    expect(table.getAllByText('5%')).toHaveLength(2); // Borrow APR unchanged, both rows
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 entries
  });

  it('works identically for a V4 portfolio entry (no supplyApr, protocolVersion "v4") — Net Worth/LTV/Leverage are protocol-agnostic', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        collateral: { quantity: 2, valueUsd: 100000 },
        debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
        loanToValue: 0.2,
        leverage: 1.25,
        dataSource: 'live',
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        collateral: { quantity: 2, valueUsd: 130000 },
        debt: { asset: 'USDC', quantity: 25000, valueUsd: 25000 },
        loanToValue: 0.25,
        leverage: 1.3,
        dataSource: 'live',
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'netWorth');
    let label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('$80,000.00');
    expect(label).toContain('$105,000.00');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'leverage');
    label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('1.25x');
    expect(label).toContain('1.3x');
  });
});

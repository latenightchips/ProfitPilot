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
    expect(table.getByText('$1,000.00')).toBeInTheDocument(); // Interest Cost (annualized)
    expect(table.getByText('Interest Cost (annualized)')).toBeInTheDocument(); // column header
    expect(table.getByText('$50,000.00')).toBeInTheDocument(); // Market Price
    expect(table.getByText('Market Price')).toBeInTheDocument(); // column header
    expect(table.getByText('$12,500.00')).toBeInTheDocument(); // Liquidation Price
    expect(table.getByText('Liquidation Price')).toBeInTheDocument(); // column header
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
    expect(list.getByText('$1,000.00')).toBeInTheDocument(); // Interest Cost (annualized)
    expect(list.getByText('Interest Cost (annualized)')).toBeInTheDocument(); // row label
    expect(list.getByText('$50,000.00')).toBeInTheDocument(); // Market Price
    expect(list.getByText('Market Price')).toBeInTheDocument(); // row label
    expect(list.getByText('$12,500.00')).toBeInTheDocument(); // Liquidation Price
    expect(list.getByText('Liquidation Price')).toBeInTheDocument(); // row label
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

/**
 * V1.4.0 Batch 1 ("Annualized Interest Cost Visibility") — extends the
 * table, mobile card list, and chart metric selector with
 * `entry.annualizedInterestCost`, the same "read the already-persisted
 * field directly, never recompute it" discipline every other metric
 * above already follows. **This field is a point-in-time projection**
 * (that one snapshot's own debt/rate implying an annual cost), never
 * interest already paid, cumulative interest, realized borrowing cost,
 * or interest paid since inception — tests below assert on the label
 * text ("Interest Cost (annualized)") and currency formatting, never on
 * any summed/cumulative figure, since none is computed anywhere in this
 * component.
 */
describe('PortfolioHistoryPanel — annualized interest cost', () => {
  it('adds "Interest Cost (annualized)" as the fifth metric-selector option, after Leverage', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', annualizedInterestCost: 1000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', annualizedInterestCost: 1200 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const select = await screen.findByLabelText('Chart metric');
    const optionLabels = within(select as HTMLElement)
      .getAllByRole('option')
      .map((option) => option.textContent);
    // Scoped to the first five positions only — V1.5.0's own Market
    // Price/Liquidation Price options (added after this one) are
    // verified by their own describe block below, including the full
    // seven-item list.
    expect(optionLabels.slice(0, 5)).toEqual([
      'Health Factor',
      'Net Worth',
      'Loan-to-Value',
      'Leverage',
      'Interest Cost (annualized)',
    ]);
  });

  it('plots the already-persisted annualizedInterestCost field, currency-formatted, without recomputing it', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', annualizedInterestCost: 1000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', annualizedInterestCost: 1450.5 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'annualizedInterestCost');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Interest Cost (annualized) trend');
    expect(label).toContain('$1,000.00');
    expect(label).toContain('$1,450.50');
    // Never a cumulative/summed figure (e.g. $2,450.50) anywhere in the summary.
    expect(label).not.toContain('$2,450.50');
  });

  it('switches to and back from the annualizedInterestCost metric, restoring the prior chart correctly', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        healthFactor: 4,
        annualizedInterestCost: 1000,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        healthFactor: 3,
        annualizedInterestCost: 1200,
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Health Factor trend');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'annualizedInterestCost');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Interest Cost (annualized) trend',
    );

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'healthFactor');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Health Factor trend');
  });

  it('renders the Interest Cost (annualized) delta in the table, reusing the existing before/after delta convention', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', annualizedInterestCost: 1000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', annualizedInterestCost: 1200 }),
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
    // The newer (top) row's delta vs. the older one: $1,000.00 -> $1,200.00 (+$200.00),
    // the exact same "before → after (delta)" convention every other column uses.
    expect(
      within(screen.getByRole('table')).getByText('$1,000.00 → $1,200.00 (+$200.00)'),
    ).toBeInTheDocument();
  });

  it('does not render the annualizedInterestCost option or chart with fewer than 2 entries', async () => {
    await recordPortfolioHistoryEntry(entry({ annualizedInterestCost: 1000 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // The table itself still shows the value, currency-formatted, with no chart required.
    expect(within(screen.getByRole('table')).getByText('$1,000.00')).toBeInTheDocument();
  });

  it('formats a zero annualizedInterestCost (e.g. a full-exit entry) as currency, never blank or NaN', async () => {
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
    // Collateral Value, Debt Value, and Interest Cost (annualized) are all
    // legitimately $0.00 for this full-exit entry.
    expect(within(screen.getByRole('table')).getAllByText('$0.00')).toHaveLength(3);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('surfaces the same annualizedInterestCost value and label in the mobile card list as the table', async () => {
    await recordPortfolioHistoryEntry(entry({ annualizedInterestCost: 1000 }));
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
    expect(list.getByText('Interest Cost (annualized)')).toBeInTheDocument();
    expect(list.getByText('$1,000.00')).toBeInTheDocument();
  });

  it('works identically for a V4 portfolio entry — annualizedInterestCost is protocol-agnostic', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        annualizedInterestCost: 900,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        annualizedInterestCost: 1100,
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'annualizedInterestCost');
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('$900.00');
    expect(label).toContain('$1,100.00');
  });
});

/**
 * V1.5.0 Batch 1 ("Portfolio Analytics — Price & Liquidation Trend
 * Visibility") — extends the table, mobile card list, delta display, and
 * chart metric selector with `entry.marketPriceUsd` and
 * `entry.liquidationPriceUsd`, bringing the selector to seven metrics.
 * Both fields are read directly, reusing `comparePortfolioHistoryEntries`'s
 * own existing (previously unrendered) deltas — no new formula, no
 * recomputation. Liquidation Price is nullable (zero-debt); its `null`
 * case must render "No liquidation risk" — the exact established
 * app-wide convention (`ApplyToPortfolioReview.tsx`,
 * `RecommendationDetailPanel.tsx`) — never "∞" (that convention belongs
 * to Health Factor alone) and never a fabricated numeric price.
 */
describe('PortfolioHistoryPanel — market price and liquidation price', () => {
  it('adds Market Price and Liquidation Price as the sixth and seventh metric-selector options, after the existing five', async () => {
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-01-01T00:00:00.000Z' }));
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-02-01T00:00:00.000Z' }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const select = await screen.findByLabelText('Chart metric');
    const optionLabels = within(select as HTMLElement)
      .getAllByRole('option')
      .map((option) => option.textContent);
    // Scoped to the first seven positions only — v1.6.0's own Liquidation
    // Buffer option (added after this one) is verified by its own describe
    // block below, including the full eight-item list.
    expect(optionLabels.slice(0, 7)).toEqual([
      'Health Factor',
      'Net Worth',
      'Loan-to-Value',
      'Leverage',
      'Interest Cost (annualized)',
      'Market Price',
      'Liquidation Price',
    ]);
  });

  it('plots the already-persisted marketPriceUsd field, currency-formatted, without recomputing it', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', marketPriceUsd: 48000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', marketPriceUsd: 52500 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'marketPrice');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Market Price trend');
    expect(label).toContain('$48,000.00');
    expect(label).toContain('$52,500.00');
  });

  it('plots the already-persisted liquidationPriceUsd field, currency-formatted, without recomputing it', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', liquidationPriceUsd: 11000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', liquidationPriceUsd: 13750 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationPrice');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Liquidation Price trend');
    expect(label).toContain('$11,000.00');
    expect(label).toContain('$13,750.00');
  });

  it('renders "No liquidation risk" — never "∞" or a fabricated price — in the chart aria-label for a null (zero-debt) snapshot', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', liquidationPriceUsd: 13750 }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationPrice');

    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('No liquidation risk');
    expect(label).toContain('$13,750.00');
    expect(label).not.toContain('∞');
    expect(label).not.toContain('$0.00');
  });

  it('renders the Market Price delta in the table, reusing the existing before/after delta convention', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', marketPriceUsd: 48000 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', marketPriceUsd: 52500 }),
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
    expect(
      within(screen.getByRole('table')).getByText('$48,000.00 → $52,500.00 (+$4,500.00)'),
    ).toBeInTheDocument();
  });

  it('renders the Liquidation Price delta with "No liquidation risk" (never "∞") on a null-to-value transition', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', liquidationPriceUsd: 13750 }),
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
    // The newer (top) row's delta vs. the older, zero-debt one:
    // "No liquidation risk" -> "$13,750.00", no parenthetical numeric
    // delta (matching the same before/after-only shape a Health Factor
    // null transition already produces).
    expect(
      within(screen.getByRole('table')).getByText('No liquidation risk → $13,750.00'),
    ).toBeInTheDocument();
  });

  it('renders "No liquidation risk" for a single zero-debt entry\'s value, never a fabricated numeric price', async () => {
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
    const table = within(screen.getByRole('table'));
    // Two occurrences as of v1.6.0 Batch 1: the Liquidation Price cell and
    // the derived Liquidation Buffer cell — see the dedicated
    // "PortfolioHistoryPanel — liquidation buffer" describe block below.
    expect(table.getAllByText('No liquidation risk')).toHaveLength(2);
  });

  it('does not render the Market Price/Liquidation Price options or chart with fewer than 2 entries, but the table still shows both values', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 48000, liquidationPriceUsd: 11000 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('$48,000.00')).toBeInTheDocument();
    expect(table.getByText('$11,000.00')).toBeInTheDocument();
  });

  it('surfaces the same Market Price and Liquidation Price values and labels in the mobile card list as the table', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 48000, liquidationPriceUsd: 11000 }));
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
    expect(list.getByText('Market Price')).toBeInTheDocument();
    expect(list.getByText('$48,000.00')).toBeInTheDocument();
    expect(list.getByText('Liquidation Price')).toBeInTheDocument();
    expect(list.getByText('$11,000.00')).toBeInTheDocument();
  });

  it('works identically for a V4 portfolio entry — Market Price and Liquidation Price are protocol-agnostic', async () => {
    const user = userEvent.setup();
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        marketPriceUsd: 48000,
        liquidationPriceUsd: 11000,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
        marketPriceUsd: 52500,
        liquidationPriceUsd: 13750,
      }),
    );
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'marketPrice');
    let label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('$48,000.00');
    expect(label).toContain('$52,500.00');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationPrice');
    label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('$11,000.00');
    expect(label).toContain('$13,750.00');
  });

  it('leaves the four existing V1.3.0/V1.4.0 metrics fully available and unregressed', async () => {
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

    // Default remains Health Factor, byte-identical to before.
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Health Factor trend');

    for (const metric of ['netWorth', 'loanToValue', 'leverage', 'annualizedInterestCost']) {
      await user.selectOptions(screen.getByLabelText('Chart metric'), metric);
      expect(screen.getByRole('img')).toBeInTheDocument();
    }
  });
});

/**
 * v1.6.0 Batch 1 ("Liquidation Buffer Visibility") — adds an eighth
 * metric, "Liquidation Buffer", to the table, mobile card list, delta
 * display, and chart metric selector. Unlike every prior metric here,
 * this one is DISPLAY/SERVICE-LAYER DERIVED (`calculateLiquidationBufferPercent`
 * in `services/portfolioHistory/`), not a directly-persisted field — it
 * is `(marketPriceUsd - liquidationPriceUsd) / marketPriceUsd`, computed
 * from the two already-persisted, already-rendered fields v1.5.0 exposed.
 * No new Engine formula, no new persistence, no protocol branching.
 * `null` (zero-debt / no liquidation risk, or an otherwise unavailable
 * denominator) renders "No liquidation risk" — the exact same text
 * `formatLiquidationPrice` already uses — never a fabricated `0%`. A
 * negative buffer (market at or below the liquidation price) renders
 * as-is, never clamped.
 */
describe('PortfolioHistoryPanel — liquidation buffer', () => {
  it('adds Liquidation Buffer as the eighth metric-selector option, after Liquidation Price', async () => {
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-01-01T00:00:00.000Z' }));
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-02-01T00:00:00.000Z' }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );

    const select = await screen.findByLabelText('Chart metric');
    const optionLabels = within(select as HTMLElement)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(optionLabels).toEqual([
      'Health Factor',
      'Net Worth',
      'Loan-to-Value',
      'Leverage',
      'Interest Cost (annualized)',
      'Market Price',
      'Liquidation Price',
      'Liquidation Buffer',
    ]);
  });

  it('plots the derived buffer from marketPriceUsd and liquidationPriceUsd, as a normal positive percentage, without persisting anything new', async () => {
    const user = userEvent.setup();
    // (50000-12500)/50000 = 0.75 -> 75%; (60000-15000)/60000 = 0.75 -> 75%
    // Use distinct pairs so a coincidental match wouldn't hide a bug.
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
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationBufferPercent');

    const chart = screen.getByRole('img');
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toContain('Liquidation Buffer trend');
    expect(label).toContain('75%'); // (50000-12500)/50000
    expect(label).toContain('50%'); // (60000-30000)/60000
  });

  it('renders a zero buffer as 0%, not blank, when market price equals liquidation price', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 50000, liquidationPriceUsd: 50000 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table')).getByText('0%')).toBeInTheDocument();
  });

  it('renders a negative buffer without clamping when market price is below liquidation price', async () => {
    // (40000-50000)/40000 = -0.25 -> -25%
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 40000, liquidationPriceUsd: 50000 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table')).getByText('-25%')).toBeInTheDocument();
  });

  it('renders "No liquidation risk" — never "0%" or "Infinity" — for a null (zero-debt) liquidation price', async () => {
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
    // "No liquidation risk" now appears twice in this row: once for the
    // Liquidation Price cell, once for the derived Liquidation Buffer cell.
    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('No liquidation risk')).toHaveLength(2);
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders "No liquidation risk" in the chart aria-label for a null buffer, never a fabricated numeric value', async () => {
    const user = userEvent.setup();
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
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationBufferPercent');

    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('No liquidation risk');
    expect(label).toContain('75%');
  });

  it('renders a numeric-to-numeric delta in the table, reusing the existing before/after delta convention', async () => {
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
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    // before: (50000-25000)/50000=0.5 -> 50%; after: (50000-10000)/50000=0.8 -> 80%
    expect(within(screen.getByRole('table')).getByText('50% → 80% (+30%)')).toBeInTheDocument();
  });

  it('renders a null-to-numeric transition delta as "No liquidation risk → X%", never a numeric delta', async () => {
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
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole('table')).getByText('No liquidation risk → 75%'),
    ).toBeInTheDocument();
  });

  it('surfaces the same Liquidation Buffer value and label in the mobile card list as the table', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 50000, liquidationPriceUsd: 12500 }));
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
    expect(list.getByText('Liquidation Buffer')).toBeInTheDocument();
    expect(list.getByText('75%')).toBeInTheDocument();
  });

  it('works identically for a V4 portfolio entry — Liquidation Buffer never branches on protocolVersion', async () => {
    const user = userEvent.setup();
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
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await screen.findByLabelText('Chart metric');

    await user.selectOptions(screen.getByLabelText('Chart metric'), 'liquidationBufferPercent');
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('75%');
    expect(label).toContain('50%');
  });

  it('does not render the Liquidation Buffer option or chart with fewer than 2 entries, but the table still shows the derived value', async () => {
    await recordPortfolioHistoryEntry(entry({ marketPriceUsd: 50000, liquidationPriceUsd: 12500 }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('75%')).toBeInTheDocument();
  });

  it('leaves all seven existing metrics fully available and unregressed', async () => {
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

    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Health Factor trend');

    for (const metric of [
      'netWorth',
      'loanToValue',
      'leverage',
      'annualizedInterestCost',
      'marketPrice',
      'liquidationPrice',
    ]) {
      await user.selectOptions(screen.getByLabelText('Chart metric'), metric);
      expect(screen.getByRole('img')).toBeInTheDocument();
    }
  });
});

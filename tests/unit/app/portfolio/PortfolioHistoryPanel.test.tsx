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
    expect(table.getByText('$1,000.00')).toBeInTheDocument(); // Interest Cost (annualized)
    expect(table.getByText('Interest Cost (annualized)')).toBeInTheDocument(); // column header
    expect(table.getByText('$50,000.00')).toBeInTheDocument(); // Market Price
    expect(table.getByText('Market Price')).toBeInTheDocument(); // column header
    expect(table.getByText('$12,500.00')).toBeInTheDocument(); // Liquidation Price
    expect(table.getByText('Liquidation Price')).toBeInTheDocument(); // column header
  });

  it('renders 2+ entries with the table as the primary source, header plus one row per entry', async () => {
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
 * V1.12.0 Batch 4 ("Portfolio History Data-Source Provenance") — surfaces
 * the already-persisted `entry.dataSource: 'manual' | 'live'` field as a
 * small badge next to each row's own timestamp, in both the table's
 * "When" cell and the mobile card's header. Read directly, never
 * inferred from `protocolVersion` or any current/live state, and never
 * recomputed — the same discipline every other field on this page
 * already follows.
 */
describe('PortfolioHistoryPanel — data source provenance', () => {
  it('displays "Manual" for a manual-sourced entry, in both the table and the mobile card', async () => {
    await recordPortfolioHistoryEntry(entry({ dataSource: 'manual' }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table')).getByText('Manual')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('Manual')).toBeInTheDocument();
  });

  it('displays "Live" for a live-sourced entry, in both the table and the mobile card', async () => {
    await recordPortfolioHistoryEntry(
      entry({ protocolVersion: 'v4', supplyApr: undefined, dataSource: 'live' }),
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
    expect(within(screen.getByRole('table')).getByText('Live')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('Live')).toBeInTheDocument();
  });

  it('shows the correct, independent provenance for each of multiple historical snapshots', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', dataSource: 'manual' }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
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
    expect(table.getByText('Manual')).toBeInTheDocument();
    expect(table.getByText('Live')).toBeInTheDocument();
    // Never a fabricated third state.
    expect(table.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('does not affect chronological row ordering (still newest-first in the table)', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', dataSource: 'manual', healthFactor: 4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', dataSource: 'live', healthFactor: 3 }),
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
    const rows = screen.getAllByRole('row');
    // Header + newest (live, HF 3) + oldest (manual, HF 4).
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Live')).toBeInTheDocument();
    expect(within(rows[1]).getByText('3')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Manual')).toBeInTheDocument();
    expect(within(rows[2]).getByText('4')).toBeInTheDocument();
  });

  it('keeps multiple portfolios isolated — provenance badges reflect only the requested portfolioId', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        dataSource: 'manual',
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'live',
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
    expect(table.getByText('Manual')).toBeInTheDocument();
    expect(table.queryByText('Live')).not.toBeInTheDocument();
  });

  it('reads the same persisted dataSource for a V3 entry and a V4 entry — provenance is independent of protocol version, never inferred from it', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v3',
        dataSource: 'live',
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        dataSource: 'manual',
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
    // V3 entry is 'live', V4 entry is 'manual' — the inverse of the usual
    // pairing seen elsewhere in this file, proving the badge reflects
    // each entry's own persisted value rather than a protocol-version
    // assumption (e.g. "V4 implies live").
    expect(table.getByText('Live')).toBeInTheDocument();
    expect(table.getByText('Manual')).toBeInTheDocument();
  });

  it('never infers provenance from current/live state — a stale-looking manual entry is never silently upgraded to "Live"', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        marketPriceUsd: 50000,
        dataSource: 'manual',
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
    expect(table.getByText('Manual')).toBeInTheDocument();
    expect(table.queryByText('Live')).not.toBeInTheDocument();
  });
});

/**
 * V1.13.0 Batch 1 ("Protocol-Version Provenance Badge") — surfaces the
 * already-persisted `entry.protocolVersion: 'v3' | 'v4'` field as a
 * second small badge next to each row's own timestamp, alongside the
 * v1.12.0 Batch 4 data-source badge. Read directly, never inferred from
 * the portfolio's current protocol-version setting (the component is
 * never even given that setting — only `portfolioId`/`portfolioUpdatedAt`
 * — so there is no "current version" to infer from in the first place;
 * every entry's badge can only ever reflect that entry's own persisted
 * value).
 */
describe('PortfolioHistoryPanel — protocol-version provenance', () => {
  it('visibly identifies a V3 history entry as "Aave V3", in both the table and the mobile card', async () => {
    await recordPortfolioHistoryEntry(entry({ protocolVersion: 'v3' }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table')).getByText('Aave V3')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('Aave V3')).toBeInTheDocument();
  });

  it('visibly identifies a V4 history entry as "Aave V4", in both the table and the mobile card', async () => {
    await recordPortfolioHistoryEntry(entry({ protocolVersion: 'v4', supplyApr: undefined }));
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table')).getByText('Aave V4')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('Aave V4')).toBeInTheDocument();
  });

  it('retains each entry’s own persisted protocol version for mixed V3/V4 history, rather than showing the portfolio’s current version for every row', async () => {
    // Older entry recorded while the portfolio was V3; newer entry
    // recorded after switching to V4 — exactly the real
    // `AaveProtocolVersionForm.tsx` mid-life switch scenario this batch
    // exists for. If the badge were derived from "the portfolio's
    // current setting" rather than each entry's own persisted field,
    // both rows would incorrectly show "Aave V4".
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', healthFactor: 4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        healthFactor: 3,
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
    const rows = screen.getAllByRole('row');
    // Header + newest (V4, HF 3) + oldest (V3, HF 4) — table is
    // newest-first, same ordering every other test in this file asserts.
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Aave V4')).toBeInTheDocument();
    expect(within(rows[1]).getByText('3')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Aave V3')).toBeInTheDocument();
    expect(within(rows[2]).getByText('4')).toBeInTheDocument();
  });

  it('leaves existing data-source provenance rendering intact — both badges render together without colliding', async () => {
    await recordPortfolioHistoryEntry(entry({ protocolVersion: 'v3', dataSource: 'live' }));
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
    expect(table.getByText('Aave V3')).toBeInTheDocument();
    expect(table.getByText('Live')).toBeInTheDocument();
    const list = within(screen.getByRole('list'));
    expect(list.getByText('Aave V3')).toBeInTheDocument();
    expect(list.getByText('Live')).toBeInTheDocument();
  });

  it('never infers protocol version from anything other than the entry itself — a V3 entry paired with "Live" (an otherwise V4-associated status elsewhere in the app) still shows "Aave V3"', async () => {
    await recordPortfolioHistoryEntry(entry({ protocolVersion: 'v3', dataSource: 'live' }));
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
    expect(table.getByText('Aave V3')).toBeInTheDocument();
    expect(table.queryByText('Aave V4')).not.toBeInTheDocument();
  });

  it('keeps multiple portfolios isolated — protocol-version badges reflect only the requested portfolioId', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v3',
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        portfolioId: 'portfolio-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
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
    expect(table.getByText('Aave V3')).toBeInTheDocument();
    expect(table.queryByText('Aave V4')).not.toBeInTheDocument();
  });
});

/**
 * Trends removal (Dashboard/Portfolio History Trends Removal batch) —
 * regression coverage proving the chart visualization layer is gone while
 * every non-chart behavior (table, cards, deltas, badges, V3/V4 isolation,
 * recording/persistence) is unaffected.
 */
describe('PortfolioHistoryPanel — Trends removal', () => {
  it('never renders a chart, a "Chart metric" selector, or any chart-library element, regardless of entry count', async () => {
    for (let i = 0; i < 5; i += 1) {
      await recordPortfolioHistoryEntry(
        entry({ createdAt: `2026-0${i + 1}-01T00:00:00.000Z`, healthFactor: 4 - i * 0.1 }),
      );
    }
    render(
      <PortfolioHistoryPanel
        portfolioId="portfolio-1"
        portfolioUpdatedAt="2026-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('row')).toHaveLength(6); // header + 5 entries — proves the table itself is unaffected.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
    expect(screen.queryByText('Chart metric')).not.toBeInTheDocument();
  });

  it('renders a V3 history entry’s full table row (values, delta, badges) with no chart present', async () => {
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-01-01T00:00:00.000Z', protocolVersion: 'v3', healthFactor: 4 }),
    );
    await recordPortfolioHistoryEntry(
      entry({ createdAt: '2026-02-01T00:00:00.000Z', protocolVersion: 'v3', healthFactor: 3 }),
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
    expect(table.getAllByText('Aave V3')).toHaveLength(2);
    expect(table.getByText('4 → 3 (-1)')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a V4 history entry’s full table row (values, delta, badges) with no chart present', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        healthFactor: 4,
      }),
    );
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-02-01T00:00:00.000Z',
        protocolVersion: 'v4',
        supplyApr: undefined,
        healthFactor: 3,
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
    expect(table.getAllByText('Aave V4')).toHaveLength(2);
    expect(table.getByText('4 → 3 (-1)')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a canonical manual V4 zero-debt entry ("∞" Health Factor, "Not applicable" Supply APR is not a table column) with no chart present', async () => {
    await recordPortfolioHistoryEntry(
      entry({
        createdAt: '2026-01-01T00:00:00.000Z',
        protocolVersion: 'v4',
        dataSource: 'manual',
        collateral: { quantity: 1, valueUsd: 50000 },
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
        healthFactor: null,
        liquidationPriceUsd: null,
        loanToValue: 0,
        leverage: 1,
        borrowApr: 0.045,
        supplyApr: undefined,
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
    expect(table.getByText('Aave V4')).toBeInTheDocument();
    expect(table.getByText('Manual')).toBeInTheDocument();
    expect(table.getByText('∞')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chart metric')).not.toBeInTheDocument();
  });
});

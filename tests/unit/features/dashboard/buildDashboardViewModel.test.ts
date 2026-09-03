import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel } from '@/features/dashboard';
import type { MarketQuote } from '@/services/market/quote';
import type { ProtocolQuote } from '@/services/protocol/quote';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Dashboard View Model — 06_TASKS.md M5-003 ("Create Dashboard View
 * Model"). Builds portfolios through the real Store (`create`) rather
 * than constructing `Portfolio` objects by hand, so every test exercises
 * the same `ServiceResult<PortfolioSummary>` shape the Dashboard route
 * will actually receive — the same convention `tests/unit/stores/
 * portfolioStore.test.ts` and `app/portfolio/page.test.tsx` already use.
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function createPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('buildDashboardViewModel — valid portfolio (M5-003)', () => {
  it('converts a Portfolio Summary Service result into UI-ready metrics without mutating it', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    const summaryBefore = JSON.parse(JSON.stringify(record.summary));

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(record.summary).toEqual(summaryBefore);
    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;

    expect(viewModel.portfolioName).toBe('My Portfolio');
    expect(viewModel.metrics.netPortfolioValue.rawValue).toBe(80000);
    expect(viewModel.metrics.netPortfolioValue.formattedValue).toBe('$80,000.00');
    expect(viewModel.metrics.netPortfolioValue.status).toBe('ok');
    expect(viewModel.metrics.netPortfolioValue.formulaId).toBe('F-004');
    expect(viewModel.metrics.healthFactor.formattedValue).toBe('4');
    expect(viewModel.metrics.loanToValue.formattedValue).toBe('20%');
    expect(viewModel.metrics.leverage.formattedValue).toBe('1.25x');
    expect(viewModel.metrics.liquidationPrice.rawValue).toBe(12500);
    expect(viewModel.metrics.liquidationDistance.rawValue).toBe(3);
    expect(viewModel.metrics.liquidationBuffer.formattedValue).toBe('75%');
  });

  it('carries Service warnings through unchanged, without attributing them to a specific metric', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    expect(viewModel.warnings).toEqual(record.summary.ok ? record.summary.warnings : []);
  });

  it('reports market and protocol freshness sourced from the portfolio record, not invented', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    expect(viewModel.freshness.market).not.toBeNull();
    expect(viewModel.freshness.market?.origin).toBe('manual');
    expect(viewModel.freshness.market?.price).toBe(50000);
    expect(viewModel.freshness.protocol).not.toBeNull();
    expect(viewModel.freshness.protocol?.origin).toBe('manual');
  });

  it('exposes the Service call’s own Engine/Formula version, for Developer Mode (M5-022, Batch 14)', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok || !record.summary.ok) return;
    expect(viewModel.engineVersion).toBe(record.summary.metadata.engineVersion);
    expect(viewModel.formulaVersion).toBe(record.summary.metadata.formulaVersion);
    expect(viewModel.engineVersion.length).toBeGreaterThan(0);
  });
});

describe('buildDashboardViewModel — zero-debt portfolio (Conflict #20)', () => {
  it('marks the liquidation metrics unavailable instead of failing the whole view model', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    expect(viewModel.metrics.liquidationPrice.status).toBe('unavailable');
    expect(viewModel.metrics.liquidationPrice.rawValue).toBeNull();
    expect(viewModel.metrics.liquidationPrice.formattedValue).toBe('N/A (no debt)');
    expect(viewModel.metrics.liquidationPrice.formulaId).toBeNull();
    // Health Factor is genuinely Infinity at zero debt (M2-009) — not unavailable.
    expect(viewModel.metrics.healthFactor.status).toBe('ok');
    expect(viewModel.metrics.healthFactor.formattedValue).toBe('∞');
  });
});

describe('buildDashboardViewModel — calculation failure (M4-017 precedent)', () => {
  it('returns an ok:false view model carrying the Service errors, without inventing partial metrics', () => {
    const portfolio = createPortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 20000 },
    });
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.summary.ok).toBe(false);

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.ok).toBe(false);
    if (viewModel.ok) return;
    expect(viewModel.portfolioName).toBe('My Portfolio');
    expect(viewModel.errors.length).toBeGreaterThan(0);
  });

  it('still populates identity and freshness (Batch 2, M5-004) even though the calculation itself failed', () => {
    const portfolio = createPortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 20000 },
    });
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.portfolioId).toBe(portfolio.id);
    expect(viewModel.freshness.market).not.toBeNull();
    expect(viewModel.freshness.market?.origin).toBe('manual');
    expect(viewModel.freshness.protocol).not.toBeNull();
  });
});

describe('buildDashboardViewModel — live Aave snapshot (Dashboard Live-State Cleanup batch)', () => {
  function liveMarketQuote(overrides: Partial<MarketQuote> = {}): MarketQuote {
    return {
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh',
      price: 63040,
      origin: 'provider',
      timestamp: '2026-08-15T12:00:00.000Z',
      ...overrides,
    } as MarketQuote;
  }

  function liveProtocolQuote(overrides: Partial<ProtocolQuote> = {}): ProtocolQuote {
    return {
      available: true,
      collateralAsset: 'WBTC',
      borrowAsset: 'USDC',
      parameters: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      origin: 'live',
      timestamp: '2026-08-15T12:00:00.000Z',
      ...overrides,
    } as ProtocolQuote;
  }

  it('reports freshness straight off a supplied live quote — not "manual" — and its own price/timestamp, not the stored portfolio value', () => {
    // The portfolio's own stored price (50000) intentionally differs from
    // the live quote (63040) — proves the live quote, not the portfolio,
    // is the source of truth for what gets reported here.
    const portfolio = createPortfolio();

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      { marketQuote: liveMarketQuote(), protocolQuote: liveProtocolQuote() },
    );

    expect(viewModel.freshness.market?.origin).toBe('provider');
    expect(viewModel.freshness.market?.price).toBe(63040);
    expect(viewModel.freshness.market?.updatedAt).toBe('2026-08-15T12:00:00.000Z');
    expect(viewModel.freshness.protocol?.origin).toBe('live');
  });

  it('reports "stale" (not "manual") when the supplied live quote itself is stale', () => {
    const portfolio = createPortfolio();

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      { marketQuote: liveMarketQuote({ freshness: 'stale' }), protocolQuote: liveProtocolQuote() },
    );

    expect(viewModel.freshness.market?.freshness).toBe('stale');
    expect(viewModel.freshness.market?.origin).toBe('provider');
  });

  it('falls back to the portfolio\'s own last-known stored value, tagged "cache" not "manual", when a live snapshot was supplied but is unavailable', () => {
    const portfolio = createPortfolio();

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      { marketQuote: null, protocolQuote: null },
    );

    expect(viewModel.freshness.market).not.toBeNull();
    expect(viewModel.freshness.market?.origin).toBe('cache');
    expect(viewModel.freshness.market?.price).toBe(50000);
    expect(viewModel.freshness.protocol).not.toBeNull();
    expect(viewModel.freshness.protocol?.origin).toBe('cache');
  });

  it('falls back to "cache," not "manual," when the supplied market quote is explicitly unavailable', () => {
    const portfolio = createPortfolio();

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      {
        marketQuote: { asset: 'BTC', currency: 'USD', freshness: 'unavailable' },
        protocolQuote: { available: false, collateralAsset: 'WBTC', borrowAsset: 'USDC' },
      },
    );

    expect(viewModel.freshness.market?.origin).toBe('cache');
    expect(viewModel.freshness.protocol?.origin).toBe('cache');
  });

  it('never touches collateral/debt — only freshness reporting changes when a live snapshot is supplied', () => {
    const portfolio = createPortfolio();

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      { marketQuote: liveMarketQuote(), protocolQuote: liveProtocolQuote() },
    );

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    // Metrics are still computed off the Engine's own PortfolioSummary
    // (the stored portfolio, kept in sync by useAaveLiveSync elsewhere),
    // never off the live quote's own price directly.
    expect(viewModel.metrics.totalCollateral.rawValue).toBe(100000);
  });

  it('does not label mismatched protocol data "live" — a USDT live quote is never applied to a USDC-debt portfolio (USDT Support milestone)', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDC', balance: 20000 } });

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      {
        marketQuote: liveMarketQuote(),
        protocolQuote: liveProtocolQuote({ borrowAsset: 'USDT' }),
      },
    );

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    // Falls through to the existing stored-value fallback, never "live".
    expect(viewModel.freshness.protocol?.origin).not.toBe('live');
    expect(viewModel.freshness.protocol?.origin).toBe('cache');
  });

  it('does not label mismatched protocol data "live" — a USDC live quote is never applied to a USDT-debt portfolio (USDT Support milestone)', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDT', balance: 20000 } });

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      {
        marketQuote: liveMarketQuote(),
        protocolQuote: liveProtocolQuote({ borrowAsset: 'USDC' }),
      },
    );

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    expect(viewModel.freshness.protocol?.origin).not.toBe('live');
  });

  it('does label protocol data "live" once the live quote\'s borrowAsset matches the portfolio\'s own debt asset (positive control)', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDT', balance: 20000 } });

    const viewModel = buildDashboardViewModel(
      portfolio,
      usePortfolioStore.getState().portfolios[portfolio.id].summary,
      {
        marketQuote: liveMarketQuote(),
        protocolQuote: liveProtocolQuote({ borrowAsset: 'USDT' }),
      },
    );

    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    expect(viewModel.freshness.protocol?.origin).toBe('live');
  });
});

describe('buildDashboardViewModel — portfolio description (M5-004)', () => {
  it('carries an explicit description through as-is', () => {
    const portfolio = createPortfolio({ description: 'Core BTC-backed loan' });
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.portfolioDescription).toBe('Core BTC-backed loan');
  });

  it('reports null, not a fabricated placeholder, when no description was set', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.portfolioDescription).toBeNull();
  });
});

describe('buildDashboardViewModel — V4 protocol freshness (V4 Mixed-Provenance UX batch, requirement D)', () => {
  it('never reports the stale V3 "Protocol Parameters" freshness row for a V4 portfolio — protocol provenance now lives entirely in the V4 provenance breakdown, not this legacy field', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    const updated = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(updated.portfolio, updated.summary);

    expect(viewModel.freshness.protocol).toBeNull();
  });

  it('still reports market freshness for a V4 portfolio (only the legacy V3 protocol-parameters row is suppressed)', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    const updated = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(updated.portfolio, updated.summary);

    expect(viewModel.freshness.market).not.toBeNull();
  });

  it('leaves V3 portfolios reporting protocol freshness exactly as before (unchanged behavior)', () => {
    const portfolio = createPortfolio();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];

    const viewModel = buildDashboardViewModel(portfolio, record.summary);

    expect(viewModel.freshness.protocol).not.toBeNull();
    expect(viewModel.freshness.protocol?.origin).toBe('manual');
  });
});

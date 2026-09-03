import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import { deriveAaveV4EffectiveBorrowRate } from '@/services';
import type { Portfolio } from '@/types/portfolio';
import {
  formatProtocolStatus,
  type ProtocolStatusKind,
  type V4ProvenanceBreakdown,
} from '@/utils/protocolStatus';

/** V4 Mixed-Provenance UX batch — see `tests/unit/utils/protocolStatus.test.ts`'s own identical fixture comment: only `.status` is asserted on below, never `.breakdown`'s own content. */
const DUMMY_V4_BREAKDOWN: V4ProvenanceBreakdown = {
  market: { btcPrice: 'live', baseDrawnApr: 'live' },
  position: 'live',
  collateralRisk: 'live',
};

/** Shared Strategy Assumptions Panel — 06_TASKS.md M7-004. */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'Test Portfolio',
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
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('StrategyAssumptionsPanel', () => {
  it('renders market price, protocol parameters, and borrow rate from the real portfolio', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByText('Protocol Parameters')).toBeInTheDocument();
    expect(screen.getByText('Borrow Rate')).toBeInTheDocument();
    expect(screen.getAllByText('5.00%').length).toBeGreaterThan(0);
  });

  it('shows "Not configured" for swap fee/slippage/gas assumptions when none are configured, in plain language (UX punch-list item 6; V4 Readiness Audit §12 P1-6)', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('Fees, Slippage & Gas Estimate')).toBeInTheDocument();
    const assumptionsText = screen.getByText(/Swap fee assumption/).textContent ?? '';
    expect(assumptionsText.match(/Not configured/g)?.length).toBe(3);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('02_Formulas.md');
    expect(bodyText).not.toContain('Formula ID');
  });

  it('shows the real configured swap fee/slippage/gas assumptions as labeled assumptions (V4 Readiness Audit §12 P1-6)', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({
          settings: {
            executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005, gasCostUsd: 15 },
          },
        })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Swap fee assumption 0\.30%/)).toBeInTheDocument();
    expect(screen.getByText(/Slippage assumption 0\.50%/)).toBeInTheDocument();
    expect(screen.getByText(/Gas cost assumption \$15\.00/)).toBeInTheDocument();
  });

  it('omits the Time Horizon row when the caller supplies null', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.queryByText('Time Horizon')).not.toBeInTheDocument();
  });

  it('renders the Time Horizon row when the caller supplies a label', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel="30 days"
      />,
    );
    expect(screen.getByText('Time Horizon')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('shows Manual-Data Status using the portfolio’s own marketUpdatedAt timestamp', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Manual Mode/)).toBeInTheDocument();
    expect(screen.getByText(/No live data provider is connected/)).toBeInTheDocument();
  });

  it('omits Formula Version when metadata is null, and shows it when present', () => {
    const { rerender } = render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.queryByText('Formula Version')).not.toBeInTheDocument();

    rerender(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={{
          sourceStatus: 'manual',
          calculationTimestamp: '2026-01-01T00:00:00.000Z',
          engineVersion: '1.0.0',
          formulaVersion: '1.0.0',
        }}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText('Engine 1.0.0 · Formula 1.0.0')).toBeInTheDocument();
  });
});

/**
 * V4 Readiness Audit §12 Stage 21 — Borrow-rate correctness. `protocol.borrowApr`
 * (99%) and `v4DebtState` (real ~5.37% effective rate) are deliberately
 * different values so a legacy-scalar leak into V4 display is directly
 * observable, the same fixture-design discipline
 * `tests/unit/features/simulation/SimulationWarnings.test.tsx`'s own Stage
 * 20 V4 describe block already established.
 */
describe('StrategyAssumptionsPanel — V4 Borrow Rate correctness (Stage 21)', () => {
  function v4Portfolio(
    v4DebtState: Portfolio['v4DebtState'] | undefined,
    overrides: Partial<Portfolio> = {},
  ): Portfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState,
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.99, // deliberately wrong for V4 — must never be displayed
        supplyApr: 0.02,
      },
      ...overrides,
    });
  }

  it('never displays the raw V3 protocol.borrowApr (99%) for a V4 portfolio', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={v4Portfolio({
          drawnDebt: 20000,
          premiumDebt: 500,
          baseDrawnApr: 0.05,
          riskPremium: 0.1,
        })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.queryByText(/99\.00%/)).not.toBeInTheDocument();
  });

  it('displays the canonical effective V4 rate identically in both the Protocol Parameters row and the Borrow Rate row', () => {
    const v4DebtState = {
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    };
    const rateStep = deriveAaveV4EffectiveBorrowRate(v4DebtState, null, 'manual');
    if (!rateStep.ok) throw new Error('setup failed: expected a valid effective rate');
    const expectedText = `${(rateStep.value * 100).toFixed(2)}%`;

    render(
      <StrategyAssumptionsPanel
        portfolio={v4Portfolio(v4DebtState)}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );

    // Standalone "Borrow Rate" row's span holds exactly this one value.
    expect(screen.getByText(expectedText)).toBeInTheDocument();
    // The Protocol Parameters row's combined text carries the identical value — both agree.
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain(expectedText);
  });

  it('shows "Not available" rather than a fabricated or stale rate when v4DebtState has not synced yet', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={v4Portfolio(undefined)}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('Not available')).toBeInTheDocument();
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain('Not available');
    expect(screen.queryByText(/99\.00%/)).not.toBeInTheDocument();
  });

  it('still shows the exact V3 borrow rate unchanged when protocolVersion is unset', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('5.00%')).toBeInTheDocument();
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain('5.00%');
  });
});

/**
 * "Supply APR" — V4 Readiness Audit §12 P1-1, corrected by the Supply
 * APR Semantic-Boundary Fix. No V4 boundary this codebase talks to
 * exposes an authoritative supply rate, and no V4-facing form ever lets a
 * user assert one manually either — so a V4 portfolio must never show
 * `protocol.supplyApr` at all, regardless of `v4CollateralRiskSource`
 * (P1-1's own now-corrected premise that manual collateral risk implied a
 * manual Supply APR assertion). The whole "Supply APR" segment is omitted
 * from the Protocol Parameters line for V4, not shown as "Not available"
 * — that wording is reserved for a value that could genuinely become
 * available later (e.g. Collateral Factor pending sync), which Supply APR
 * for V4 never is. `protocol.supplyApr` here is a plausible non-zero
 * rate, never zero, so a silently-retained leak would be directly
 * observable.
 */
describe('StrategyAssumptionsPanel — Supply APR (P1-1, corrected by the Supply APR Semantic-Boundary Fix)', () => {
  it('V3: shows the real protocol.supplyApr, unchanged', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain('Supply APR 2.00%');
  });

  it('live V4: omits "Supply APR" entirely, never the leftover protocol.supplyApr figure', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({
          protocolVersion: 'v4',
          v4CollateralRisk: { collateralFactor: 0.7, dynamicConfigKey: 1 },
          v4CollateralRiskSource: 'live',
          protocol: {
            maxLoanToValue: 0.75,
            liquidationThreshold: 0.8,
            borrowApr: 0.05,
            supplyApr: 0.045, // deliberately non-zero, plausible — must never be displayed
          },
        })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).not.toContain('Supply APR');
    expect(protocolParamsValue?.textContent).not.toContain('4.50%');
  });

  it('V4 with no v4CollateralRisk synced yet: omits "Supply APR" entirely, not the inherited figure', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({ protocolVersion: 'v4' })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).not.toContain('Supply APR');
  });

  it('manual V4: STILL omits "Supply APR" entirely — manually asserting collateralFactor is not the same as asserting protocol.supplyApr (the exact P1-1 bug this fix closes)', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({
          protocolVersion: 'v4',
          v4CollateralRisk: { collateralFactor: 0.7, dynamicConfigKey: 1 },
          v4CollateralRiskSource: 'manual',
        })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).not.toContain('Supply APR');
    expect(protocolParamsValue?.textContent).not.toContain('2.00%');
  });
});

/**
 * V4 Readiness Audit §12 Stage 21 — Manual-Data Status / freshness.
 * `protocolStatus` is an optional prop so every pre-Stage-21 caller
 * (including every test above, which never passes it) keeps rendering the
 * exact original static Manual Mode copy — no test file above needed to
 * change for this stage.
 *
 * **V1.1 Batch 6 — a supplied V3 `protocolStatus` is no longer
 * discarded.** See `StrategyAssumptionsPanel.tsx`'s own updated header
 * comment: before this batch, an explicit `{version:'v3',...}` status
 * rendered the exact same static "No live data provider is connected"
 * copy as no status at all — a real inconsistency with
 * `PortfolioPageClient.tsx`'s own already-fixed local badges. The test
 * below now pins the corrected behavior.
 */
describe('StrategyAssumptionsPanel — protocol-aware Manual-Data Status (Stage 21 / V1.1 Batch 6)', () => {
  it.each([
    { version: 'v3', status: 'live' },
    { version: 'v3', status: 'stale' },
    { version: 'v3', status: 'unavailable' },
  ] satisfies ProtocolStatusKind[])(
    'V1.1 Batch 6: renders the real V3 status ($status) via formatProtocolStatus, never the static "No live data provider" copy',
    (protocolStatus) => {
      render(
        <StrategyAssumptionsPanel
          portfolio={basePortfolio()}
          metadata={null}
          timeHorizonLabel={null}
          protocolStatus={protocolStatus}
        />,
      );
      expect(screen.getByText(formatProtocolStatus(protocolStatus))).toBeInTheDocument();
      expect(screen.queryByText(/No live data provider is connected/)).not.toBeInTheDocument();
    },
  );

  it('V1.1 Batch 6: with no protocolStatus but marketSource "live", states the portfolio is live-synced rather than claiming no provider is connected', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({ marketSource: 'live' })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Live-synced/)).toBeInTheDocument();
    expect(screen.getByText(/last updated/)).toBeInTheDocument();
    expect(screen.queryByText(/No live data provider is connected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manual Mode/)).not.toBeInTheDocument();
  });

  it('V1.1 Batch 6: with no protocolStatus and marketSource "manual" (or unset — a V1-era save), keeps the original Manual Mode copy unchanged', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({ marketSource: undefined })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Manual Mode/)).toBeInTheDocument();
    expect(screen.getByText(/No live data provider is connected/)).toBeInTheDocument();
  });

  it.each([
    { version: 'v4', status: 'waiting-for-address', breakdown: DUMMY_V4_BREAKDOWN },
    { version: 'v4', status: 'loading', breakdown: DUMMY_V4_BREAKDOWN },
    { version: 'v4', status: 'stale', breakdown: DUMMY_V4_BREAKDOWN },
    { version: 'v4', status: 'provider-error', breakdown: DUMMY_V4_BREAKDOWN },
    { version: 'v4', status: 'missing-debt-state', breakdown: DUMMY_V4_BREAKDOWN },
  ] satisfies ProtocolStatusKind[])(
    // V4 Mixed-Provenance UX batch — `'live'` (and `'manual'`) moved to
    // their own dedicated test below: those two are the only composite
    // statuses this component now replaces with the truthful per-dimension
    // breakdown rather than `formatProtocolStatus`'s single string (see
    // `PortfolioPageClient.tsx`'s own header comment for why). Every
    // status here keeps the original text unchanged.
    'renders the real V4 status ($status) via formatProtocolStatus, never the static V3 "Manual Mode" copy',
    (protocolStatus) => {
      render(
        <StrategyAssumptionsPanel
          portfolio={basePortfolio({ protocolVersion: 'v4' })}
          metadata={null}
          timeHorizonLabel={null}
          protocolStatus={protocolStatus}
        />,
      );
      expect(screen.getByText(formatProtocolStatus(protocolStatus))).toBeInTheDocument();
      expect(screen.queryByText(/Manual Mode/)).not.toBeInTheDocument();
      expect(screen.queryByText(/No live data provider is connected/)).not.toBeInTheDocument();
    },
  );

  it.each(['live', 'manual'] as const)(
    'renders the truthful per-dimension breakdown, never a collapsed "Aave V4 · %s" string, for the %s composite status',
    (status) => {
      const protocolStatus: ProtocolStatusKind = {
        version: 'v4',
        status,
        breakdown: DUMMY_V4_BREAKDOWN,
      };
      render(
        <StrategyAssumptionsPanel
          portfolio={basePortfolio({ protocolVersion: 'v4' })}
          metadata={null}
          timeHorizonLabel={null}
          protocolStatus={protocolStatus}
        />,
      );
      expect(screen.getByText('BTC price Live')).toBeInTheDocument();
      expect(screen.getByText('Base drawn APR Live')).toBeInTheDocument();
      expect(screen.getByText('Debt position Live')).toBeInTheDocument();
      expect(screen.getByText('Collateral risk Live')).toBeInTheDocument();
      expect(screen.queryByText(formatProtocolStatus(protocolStatus))).not.toBeInTheDocument();
      expect(screen.queryByText(/Manual Mode/)).not.toBeInTheDocument();
    },
  );
});

/**
 * "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
 * Readiness Audit §12 Stage 23E. V4 has no separate max-LTV/liquidation-
 * threshold pair (Stage 23B), so showing the V3-shaped pair for a V4
 * portfolio would render `portfolio.protocol.maxLoanToValue`/
 * `.liquidationThreshold` — legacy fields with no defined relationship to
 * V4's real `collateralFactor`.
 */
describe('StrategyAssumptionsPanel — V4 risk-capacity display (Stage 23E)', () => {
  it('shows Collateral Factor (never Max LTV/Liquidation Threshold) for a V4 portfolio with synced v4CollateralRisk', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({
          protocolVersion: 'v4',
          v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
        })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Collateral Factor 65\.00%/)).toBeInTheDocument();
    expect(screen.queryByText(/Max LTV/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Liquidation Threshold/)).not.toBeInTheDocument();
  });

  it('shows "Collateral Factor Not available" when v4CollateralRisk has not synced yet, never falling back to a V3 number', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio({ protocolVersion: 'v4' })}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Collateral Factor Not available/)).toBeInTheDocument();
    expect(screen.queryByText(/Max LTV/)).not.toBeInTheDocument();
  });

  it('a V3 (or unset) portfolio is completely unaffected — still shows Max LTV/Liquidation Threshold', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Max LTV 75\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/Liquidation Threshold 80\.00%/)).toBeInTheDocument();
    expect(screen.queryByText(/Collateral Factor/)).not.toBeInTheDocument();
  });
});

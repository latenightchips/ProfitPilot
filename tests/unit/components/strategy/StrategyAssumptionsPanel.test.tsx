import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import { deriveAaveV4EffectiveBorrowRate } from '@/services';
import type { Portfolio } from '@/types/portfolio';
import { formatProtocolStatus, type ProtocolStatusKind } from '@/utils/protocolStatus';

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

  it('itemizes fees, slippage, and gas estimate as unavailable rather than fabricating values, in plain language (UX punch-list item 6)', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(
      screen.getByText('Estimated fees, slippage, and gas costs are not included.'),
    ).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('02_Formulas.md');
    expect(bodyText).not.toContain('Formula ID');
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
 * V4 Readiness Audit §12 Stage 21 — Manual-Data Status / freshness.
 * `protocolStatus` is an optional prop so every pre-Stage-21 caller
 * (including every test above, which never passes it) keeps rendering the
 * exact original static Manual Mode copy — no test file above needed to
 * change for this stage.
 */
describe('StrategyAssumptionsPanel — protocol-aware Manual-Data Status (Stage 21)', () => {
  it('renders the exact original static V3 copy when protocolStatus is explicitly a v3 status, byte-identical to the no-prop case', () => {
    const v3Status: ProtocolStatusKind = { version: 'v3', status: 'live' };
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
        protocolStatus={v3Status}
      />,
    );
    expect(screen.getByText(/Manual Mode/)).toBeInTheDocument();
    expect(screen.getByText(/No live data provider is connected/)).toBeInTheDocument();
  });

  it.each([
    { version: 'v4', status: 'waiting-for-address' },
    { version: 'v4', status: 'loading' },
    { version: 'v4', status: 'live' },
    { version: 'v4', status: 'stale' },
    { version: 'v4', status: 'provider-error' },
    { version: 'v4', status: 'missing-debt-state' },
  ] satisfies ProtocolStatusKind[])(
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

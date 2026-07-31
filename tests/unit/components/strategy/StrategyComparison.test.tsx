import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StrategyComparison } from '@/components/strategy/StrategyComparison';
import type { StrategyComparisonResult } from '@/types/strategy';

/**
 * Shared Before-and-After Comparison Component — 06_TASKS.md M7-003.
 * `StrategyComparisonResult` fixtures are hand-built (no Loop/Exit
 * Store exists yet this batch — see `StrategyComparison.tsx`'s own
 * header comment), but every field mirrors a real `PortfolioSummary`
 * (`services/portfolio/summary.ts`, M3-005) shape exactly.
 */
function baseline(overrides: Partial<StrategyComparisonResult['before']['summary']> = {}) {
  return {
    summary: {
      collateralValue: 100000,
      debtValue: 20000,
      netEquity: 80000,
      loanToValue: 0.2,
      leverage: 1.25,
      healthFactor: 4,
      liquidation: { price: 26667, distance: 0.7333, buffer: 30000 },
      interestCost: 1000,
      ...overrides,
    },
    btcExposure: 2,
  };
}

describe('StrategyComparison — feasible result', () => {
  it('renders all 9 documented metrics with current and proposed values', () => {
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline(),
      after: { ...baseline({ healthFactor: 6, loanToValue: 0.1 }), btcExposure: 3 },
    };
    render(<StrategyComparison result={result} />);

    for (const label of [
      'Collateral',
      'Debt',
      'Net Equity',
      'Health Factor',
      'LTV',
      'Leverage',
      'Liquidation Price',
      'Interest Cost',
      'BTC Exposure',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('tags a Health Factor increase as "Improved" — higher is documented as safer (F-022)', () => {
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline({ healthFactor: 4 }),
      after: baseline({ healthFactor: 6 }),
    };
    render(<StrategyComparison result={result} />);
    expect(screen.getAllByText('Improved').length).toBeGreaterThan(0);
  });

  it('tags an LTV increase as "Worsened" — lower LTV is documented as safer', () => {
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline({ loanToValue: 0.2 }),
      after: baseline({ loanToValue: 0.5 }),
    };
    render(<StrategyComparison result={result} />);
    expect(screen.getAllByText('Worsened').length).toBeGreaterThan(0);
  });

  it('does not tag Collateral, Net Equity, Leverage, or BTC Exposure changes as improvement or deterioration', () => {
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline(),
      after: {
        summary: { ...baseline().summary, collateralValue: 200000, netEquity: 160000, leverage: 2 },
        btcExposure: 4,
      },
    };
    render(<StrategyComparison result={result} />);
    // Only Health Factor/LTV/Debt/Interest Cost/Liquidation Price are unchanged here (equal before/after), so no tags at all should render.
    expect(screen.queryByText('Improved')).not.toBeInTheDocument();
    expect(screen.queryByText('Worsened')).not.toBeInTheDocument();
  });
});

describe('StrategyComparison — infeasible result', () => {
  it('renders an em dash for every "proposed" cell when after is null', () => {
    const result: StrategyComparisonResult = {
      feasible: false,
      before: baseline(),
      after: null,
    };
    render(<StrategyComparison result={result} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9);
  });
});

describe('StrategyComparison — zero-debt liquidation price', () => {
  it('renders an em dash instead of fabricating a liquidation price', () => {
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline({ liquidation: null, debtValue: 0 }),
      after: baseline({ liquidation: null, debtValue: 0 }),
    };
    render(<StrategyComparison result={result} />);
    expect(screen.getByText('Liquidation Price').closest('tr')?.textContent).toContain('—');
  });
});

describe('StrategyComparison — non-finite leverage (zero-equity edge case)', () => {
  it('renders an em dash instead of Infinity for Leverage', () => {
    // A zero-net-equity portfolio (collateral value equal to debt value)
    // — a real, reachable Milestone 4 state — makes leverage
    // (collateral / equity) a genuine `Infinity`, not a hand-picked edge
    // value. `formatCurrency`'s own equivalent guard (`format.ts` line
    // 14) is left untested here: unlike leverage, no currency field this
    // component renders (collateral/debt/net equity/interest
    // cost/liquidation price) can genuinely reach a non-finite value
    // through real Engine arithmetic — the same "defensive but
    // unreachable in practice" class of code this engagement has
    // consistently left untested elsewhere (Milestone 6 Batch 22's own
    // audit).
    const result: StrategyComparisonResult = {
      feasible: true,
      before: baseline({ leverage: Infinity }),
      after: baseline({ leverage: Infinity }),
    };
    render(<StrategyComparison result={result} />);
    expect(screen.getByText('Leverage').closest('tr')?.textContent).toContain('—');
  });
});

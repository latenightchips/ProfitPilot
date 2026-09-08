import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildRecommendationSummary, RecommendationSummarySection } from '@/features/dashboard';
import type {
  RecommendationSummary,
  RecommendationSummaryItem,
} from '@/features/dashboard/types/recommendationSummary';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Recommendation Summary Section — 06_TASKS.md M5-015.
 *
 * **v1.19.0 Batch 2** (Dashboard Recommendation Summary Parity, UI
 * Wiring) — the "empty states" and "active recommendations" describe
 * blocks below (real-portfolio-driven, via `buildRecommendationSummary`)
 * are unchanged from before this batch and continue to prove Repayment/
 * Additional Collateral rendering is unaffected. The new blocks below
 * them use hand-built `RecommendationSummary` fixtures — per this
 * batch's own instruction to test UI rendering, not recommendation
 * formulas — to cover zero-through-four items, canonical ordering,
 * Borrow/Loop presentation-text passthrough, and accessibility/list
 * semantics.
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

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  return created.data;
}

describe('RecommendationSummarySection — empty states (M5-020, Batch 9)', () => {
  it('explains that no target is configured, with a link to set one', () => {
    const portfolio = createPortfolio();
    render(<RecommendationSummarySection summary={buildRecommendationSummary(portfolio)} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText(/No target Health Factor is configured/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set a target Health Factor' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });

  it('explains that the target is already met, with no action link', () => {
    // Current Health Factor = 4 (2 BTC * $50,000 * 0.8 threshold / $20,000 debt); target of 1 is already exceeded.
    const portfolio = createPortfolio({ settings: { safetyTargets: { targetHealthFactor: 1 } } });
    render(<RecommendationSummarySection summary={buildRecommendationSummary(portfolio)} />);

    expect(screen.getByText(/already meets or exceeds your configured target/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('RecommendationSummarySection — active recommendations', () => {
  it('renders the section heading and both recommendation entries', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    render(<RecommendationSummarySection summary={buildRecommendationSummary(portfolio)} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('Priority 2')).toBeInTheDocument();
    expect(screen.getByText('Category: debtManagement')).toBeInTheDocument();
    expect(screen.getByText('Category: collateralManagement')).toBeInTheDocument();
  });
});

/**
 * v1.19.0 Batch 2 — hand-built fixtures. `item()` produces a complete,
 * valid `RecommendationSummaryItem` with deliberately distinctive,
 * non-formula-looking strings (never real Engine copy) so a passing
 * assertion can only mean this component rendered exactly what it was
 * given, not that it happens to match real recommendation wording.
 */
function item(overrides: Partial<RecommendationSummaryItem> = {}): RecommendationSummaryItem {
  return {
    priority: 1,
    category: 'debtManagement',
    riskLevel: 'Maintain Target Health Factor',
    explanation: 'Fixture explanation text',
    suggestedAction: 'Fixture suggested action text',
    expectedEffect: 'Fixture expected effect text',
    ...overrides,
  };
}

function summaryFixture(items: RecommendationSummaryItem[]): RecommendationSummary {
  return { items, emptyReason: items.length === 0 ? 'target_met' : null };
}

const REPAYMENT_ITEM = item({
  priority: 1,
  category: 'debtManagement',
  riskLevel: 'Maintain Target Health Factor',
  explanation: 'Repayment fixture explanation',
  suggestedAction: 'Repayment fixture suggested action',
  expectedEffect: 'Repayment fixture expected effect',
});
const COLLATERAL_ITEM = item({
  priority: 2,
  category: 'collateralManagement',
  riskLevel: 'Maintain Target Health Factor',
  explanation: 'Collateral fixture explanation',
  suggestedAction: 'Collateral fixture suggested action',
  expectedEffect: 'Collateral fixture expected effect',
});
const BORROW_ITEM = item({
  priority: 3,
  category: 'debtManagement',
  riskLevel: 'Improve Capital Efficiency',
  explanation: 'Zzyx borrow presentation headline, not real Engine copy',
  suggestedAction: 'Zzyx borrow presentation detail, not real Engine copy',
  expectedEffect: 'Zzyx borrow fixture expected effect',
});
const LOOP_ITEM = item({
  priority: 4,
  category: 'leverage',
  riskLevel: 'Improve Capital Efficiency',
  explanation: 'Qwerp loop presentation headline, not real Engine copy',
  suggestedAction: 'Qwerp loop presentation detail, not real Engine copy',
  expectedEffect: 'Qwerp loop fixture expected effect',
});

describe('RecommendationSummarySection — unavailable empty state (fixture)', () => {
  it('renders the "unavailable" message for zero items with emptyReason "unavailable"', () => {
    render(<RecommendationSummarySection summary={{ items: [], emptyReason: 'unavailable' }} />);
    expect(screen.getByText('Recommendations are currently unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('RecommendationSummarySection — variable item counts (fixture)', () => {
  it('renders exactly one recommendation entry', () => {
    render(<RecommendationSummarySection summary={summaryFixture([REPAYMENT_ITEM])} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('Repayment fixture explanation')).toBeInTheDocument();
  });

  it('renders a Borrow item correctly (category debtManagement, tier Improve Capital Efficiency)', () => {
    render(<RecommendationSummarySection summary={summaryFixture([BORROW_ITEM])} />);
    expect(screen.getByText('Category: debtManagement')).toBeInTheDocument();
    expect(screen.getByText('Risk level: Improve Capital Efficiency')).toBeInTheDocument();
    expect(
      screen.getByText('Zzyx borrow presentation headline, not real Engine copy'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Zzyx borrow presentation detail, not real Engine copy'),
    ).toBeInTheDocument();
  });

  it('renders a Loop item correctly (category leverage, tier Improve Capital Efficiency)', () => {
    render(<RecommendationSummarySection summary={summaryFixture([LOOP_ITEM])} />);
    expect(screen.getByText('Category: leverage')).toBeInTheDocument();
    expect(screen.getByText('Risk level: Improve Capital Efficiency')).toBeInTheDocument();
    expect(
      screen.getByText('Qwerp loop presentation headline, not real Engine copy'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Qwerp loop presentation detail, not real Engine copy'),
    ).toBeInTheDocument();
  });

  it('renders Borrow and Loop together', () => {
    render(<RecommendationSummarySection summary={summaryFixture([BORROW_ITEM, LOOP_ITEM])} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Priority 3')).toBeInTheDocument();
    expect(screen.getByText('Priority 4')).toBeInTheDocument();
  });

  it('renders all four canonical recommendations at once', () => {
    render(
      <RecommendationSummarySection
        summary={summaryFixture([REPAYMENT_ITEM, COLLATERAL_ITEM, BORROW_ITEM, LOOP_ITEM])}
      />,
    );
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(4);
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('Priority 2')).toBeInTheDocument();
    expect(screen.getByText('Priority 3')).toBeInTheDocument();
    expect(screen.getByText('Priority 4')).toBeInTheDocument();
  });
});

describe('RecommendationSummarySection — canonical ordering is preserved, not re-sorted', () => {
  it('renders list items in exactly the array order supplied, regardless of category/riskLevel', () => {
    render(
      <RecommendationSummarySection
        summary={summaryFixture([REPAYMENT_ITEM, COLLATERAL_ITEM, BORROW_ITEM, LOOP_ITEM])}
      />,
    );
    const list = screen.getByRole('list');
    const listItems = within(list).getAllByRole('listitem');
    const explanations = listItems.map(
      (li) => within(li).getByText(/fixture explanation|headline/i).textContent,
    );
    expect(explanations).toEqual([
      'Repayment fixture explanation',
      'Collateral fixture explanation',
      'Zzyx borrow presentation headline, not real Engine copy',
      'Qwerp loop presentation headline, not real Engine copy',
    ]);
  });
});

describe('RecommendationSummarySection — presentation text passthrough, no independent derivation', () => {
  it('renders the exact explanation/suggestedAction/expectedEffect strings supplied, verbatim, for every item', () => {
    render(
      <RecommendationSummarySection
        summary={summaryFixture([REPAYMENT_ITEM, COLLATERAL_ITEM, BORROW_ITEM, LOOP_ITEM])}
      />,
    );
    for (const fixture of [REPAYMENT_ITEM, COLLATERAL_ITEM, BORROW_ITEM, LOOP_ITEM]) {
      expect(screen.getByText(fixture.explanation)).toBeInTheDocument();
      expect(screen.getByText(fixture.suggestedAction)).toBeInTheDocument();
      expect(screen.getByText(fixture.expectedEffect)).toBeInTheDocument();
    }
    // No numeric/financial value is ever rendered — RecommendationSummaryItem
    // carries no relevantValues field, and this component reads only the
    // six fixed display fields; nothing here could recompute a formula.
    expect(screen.queryByText(/\$|USD|BTC/)).not.toBeInTheDocument();
  });
});

describe('RecommendationSummarySection — accessibility / list semantics', () => {
  it('exposes a heading and a list/listitem structure whose item count matches summary.items', () => {
    render(
      <RecommendationSummarySection
        summary={summaryFixture([REPAYMENT_ITEM, COLLATERAL_ITEM, BORROW_ITEM])}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders no list at all in any empty state — no empty <ol> left in the accessibility tree', () => {
    render(<RecommendationSummarySection summary={{ items: [], emptyReason: 'no_target' }} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

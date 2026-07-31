import type { StrategyComparisonResult } from '@/types/strategy';

import { formatCurrency, formatHealthFactor, formatLeverage, formatPercent } from './format';

/**
 * Shared Before-and-After Comparison Component — 06_TASKS.md M7-003
 * ("Create Shared Before-and-After Comparison Component"). Dependencies:
 * M7-002. Priority P1, Effort M. Support: "Collateral, Debt, Net equity,
 * Health Factor, LTV, Leverage, Liquidation price, Interest cost, BTC
 * exposure." Requirements: "Display improvements and deteriorations
 * without relying on color alone." DoD: "The component supports Loop
 * Builder and Exit Planner results."
 *
 * **Every value comes directly from `StrategyComparisonResult`
 * (`types/strategy.ts`, M7-002) — zero recalculation**, satisfying
 * M7-002's own DoD as much as this component's own.
 *
 * **Only 5 of the 9 metrics are classified as an "improvement" or
 * "deterioration" — Health Factor, LTV, Debt, Interest cost, and
 * Liquidation price.** Each has a documented, universal safety
 * direction the Formula Engine itself establishes: Health Factor's own
 * liquidation boundary (F-022, "Above 1.0 Safe... Below 1.0
 * Liquidation") makes higher always safer; LTV moves inversely to
 * Health Factor by definition; less Debt and less Interest cost are
 * definitionally smaller liabilities; a lower Liquidation price means
 * more room before liquidation at an unchanged market price (Health
 * Factor's own distance relationship). The remaining 4 — Collateral,
 * Net equity, Leverage, BTC exposure — are deliberately left
 * unclassified: Loop Builder's own stated purpose is to *increase* them
 * and Exit Planner's own stated purpose is to *decrease* them, so
 * labeling either direction "improvement" here would be inventing a
 * judgment this component has no documented basis for. Their raw
 * before/after change is still shown — just without a favorable/
 * unfavorable tag.
 *
 * **"Without relying on color alone"**: classified rows carry a visible
 * text tag ("Improved"/"Worsened"), not just a colored number — the
 * same requirement `03_UI.md`'s own Simulation Workspace "Portfolio
 * Comparison" section named (Milestone 6 Batch 25's own Conflict #31
 * note observed the color-only version was never built there either;
 * this component satisfies the requirement for real from the start).
 *
 * **`after: null` (an infeasible strategy) renders the "after" column
 * as "—" for every row**, not a blank or a fabricated value — mirrors
 * `ExitPlanResult.after`'s own convention (M3-011).
 */
type ComparisonMetric =
  | 'collateral'
  | 'debt'
  | 'netEquity'
  | 'healthFactor'
  | 'ltv'
  | 'leverage'
  | 'liquidationPrice'
  | 'interestCost'
  | 'btcExposure';

const METRIC_LABELS: Record<ComparisonMetric, string> = {
  collateral: 'Collateral',
  debt: 'Debt',
  netEquity: 'Net Equity',
  healthFactor: 'Health Factor',
  ltv: 'LTV',
  leverage: 'Leverage',
  liquidationPrice: 'Liquidation Price',
  interestCost: 'Interest Cost',
  btcExposure: 'BTC Exposure',
};

const METRIC_ORDER: ComparisonMetric[] = [
  'collateral',
  'debt',
  'netEquity',
  'healthFactor',
  'ltv',
  'leverage',
  'liquidationPrice',
  'interestCost',
  'btcExposure',
];

/** Lower is safer for these; Health Factor is the one higher-is-safer metric. */
const LOWER_IS_IMPROVEMENT: ReadonlySet<ComparisonMetric> = new Set([
  'debt',
  'ltv',
  'liquidationPrice',
  'interestCost',
]);
const CLASSIFIED_METRICS: ReadonlySet<ComparisonMetric> = new Set([
  'healthFactor',
  'ltv',
  'debt',
  'interestCost',
  'liquidationPrice',
]);

function formatMetric(metric: ComparisonMetric, value: number | null): string {
  if (value === null) return '—';
  switch (metric) {
    case 'healthFactor':
      return formatHealthFactor(value);
    case 'ltv':
      return formatPercent(value);
    case 'leverage':
      return formatLeverage(value);
    default:
      return formatCurrency(value);
  }
}

function extractValue(
  metric: ComparisonMetric,
  baseline: StrategyComparisonResult['before'] | null,
): number | null {
  if (baseline === null) return null;
  switch (metric) {
    case 'collateral':
      return baseline.summary.collateralValue;
    case 'debt':
      return baseline.summary.debtValue;
    case 'netEquity':
      return baseline.summary.netEquity;
    case 'healthFactor':
      return baseline.summary.healthFactor;
    case 'ltv':
      return baseline.summary.loanToValue;
    case 'leverage':
      return baseline.summary.leverage;
    case 'liquidationPrice':
      return baseline.summary.liquidation?.price ?? null;
    case 'interestCost':
      return baseline.summary.interestCost;
    case 'btcExposure':
      return baseline.btcExposure;
  }
}

type Direction = 'improvement' | 'deterioration' | 'neutral';

function classifyDirection(
  metric: ComparisonMetric,
  before: number | null,
  after: number | null,
): Direction {
  if (!CLASSIFIED_METRICS.has(metric) || before === null || after === null || before === after) {
    return 'neutral';
  }
  const afterIsLower = after < before;
  const lowerIsGood = LOWER_IS_IMPROVEMENT.has(metric);
  return afterIsLower === lowerIsGood ? 'improvement' : 'deterioration';
}

function DirectionTag({ direction }: { direction: Direction }) {
  if (direction === 'neutral') return null;
  const label = direction === 'improvement' ? 'Improved' : 'Worsened';
  const className =
    direction === 'improvement' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive';
  return <span className={`text-xs font-medium ${className}`}>{label}</span>;
}

export function StrategyComparison({ result }: { result: StrategyComparisonResult }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Before-and-after strategy comparison</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-2 font-medium">
            Metric
          </th>
          <th scope="col" className="py-2 font-medium">
            Current
          </th>
          <th scope="col" className="py-2 font-medium">
            Proposed
          </th>
        </tr>
      </thead>
      <tbody>
        {METRIC_ORDER.map((metric) => {
          const beforeValue = extractValue(metric, result.before);
          const afterValue = result.after !== null ? extractValue(metric, result.after) : null;
          const direction = classifyDirection(metric, beforeValue, afterValue);
          return (
            <tr key={metric} className="border-b border-border/50">
              <td className="py-2 text-muted-foreground">{METRIC_LABELS[metric]}</td>
              <td className="py-2 text-foreground">{formatMetric(metric, beforeValue)}</td>
              <td className="py-2 text-foreground">
                <span className="flex items-center gap-2">
                  {formatMetric(metric, afterValue)}
                  <DirectionTag direction={direction} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

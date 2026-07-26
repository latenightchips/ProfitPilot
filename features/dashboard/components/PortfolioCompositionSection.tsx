import type { PortfolioComposition, PortfolioCompositionRow } from '../types/portfolioComposition';

/**
 * Portfolio Composition Section — 06_TASKS.md M5-011. DoD: "Users can
 * understand what contributes to total collateral and debt." "Use:
 * Table on larger screens, Compact cards on smaller screens."
 *
 * A table (`sm:` and up) and a stacked card list (below `sm:`) render
 * the identical two rows — Tailwind's `hidden`/`sm:hidden` utilities
 * toggle which is visible, avoiding a second data-fetching or
 * formatting path for the same two rows.
 *
 * M5-012 ("Implement Portfolio Allocation Chart") renders nothing here —
 * see `../types/portfolioComposition.ts`'s own header comment for why
 * `composition.showAllocationChart` is always `false` under Conflict A,
 * and why no chart component was built.
 */
const ROWS: { key: 'collateral' | 'debt'; label: string }[] = [
  { key: 'collateral', label: 'Collateral' },
  { key: 'debt', label: 'Debt' },
];

function CompactCard({ label, row }: { label: string; row: PortfolioCompositionRow }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">
        {label} — {row.assetLabel}
      </div>
      <div className="text-sm text-foreground">Quantity: {row.formattedQuantity}</div>
      <div className="text-sm text-foreground">Current price: {row.formattedCurrentPrice}</div>
      <div className="text-sm text-foreground">Value: {row.formattedPositionValue}</div>
      <div className="text-sm text-foreground">
        Portfolio percentage: {row.formattedPortfolioPercentage}
      </div>
    </div>
  );
}

export function PortfolioCompositionSection({
  composition,
}: {
  composition: PortfolioComposition;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Portfolio Composition</h3>

      <table className="hidden w-full text-left text-sm sm:table">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-2">Position</th>
            <th className="pb-2">Asset</th>
            <th className="pb-2">Quantity</th>
            <th className="pb-2">Current Price</th>
            <th className="pb-2">Value</th>
            <th className="pb-2">Portfolio %</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label }) => {
            const row = composition[key];
            return (
              <tr key={key} className="border-t border-border">
                <td className="py-2 text-foreground">{label}</td>
                <td className="py-2 text-foreground">{row.assetLabel}</td>
                <td className="py-2 text-foreground">{row.formattedQuantity}</td>
                <td className="py-2 text-foreground">{row.formattedCurrentPrice}</td>
                <td className="py-2 text-foreground">{row.formattedPositionValue}</td>
                <td className="py-2 text-foreground">{row.formattedPortfolioPercentage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-col gap-2 sm:hidden">
        {ROWS.map(({ key, label }) => (
          <CompactCard key={key} label={label} row={composition[key]} />
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Protocol Parameters</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground">
          <span>Maximum LTV: {composition.protocolParameters.formattedMaxLoanToValue}</span>
          <span>
            Liquidation Threshold: {composition.protocolParameters.formattedLiquidationThreshold}
          </span>
          <span>Borrow APR: {composition.protocolParameters.formattedBorrowApr}</span>
          <span>Supply APR: {composition.protocolParameters.formattedSupplyApr}</span>
        </div>
      </div>
    </div>
  );
}

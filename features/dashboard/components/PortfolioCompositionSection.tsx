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
 *
 * **`overflow-x-auto` wrapper + `whitespace-nowrap` cells (Milestone 5
 * Batch 12, M5-023 "Implement Dashboard Responsive Layout")**: a real,
 * empirically-confirmed issue, not assumed — at exactly the width where
 * the sidebar first appears (`md:`, 768px) but before the KPI grid's own
 * `lg:` breakpoint, this table's 6 columns had no room to lay out
 * normally and visibly ran together ("CollateralBTC 2," "Portfolio %"
 * wrapping onto two lines), found via an actual Playwright screenshot at
 * that exact viewport, not just reading Tailwind classes. A horizontally
 * scrollable table confined to its own container is the standard,
 * widely-accepted way to satisfy this task's own "Tables must adapt
 * appropriately" Requirement without violating its "No horizontal page
 * scrolling" Requirement — the scroll is local to the table, never the
 * page. The `sm:`-and-below compact-card fallback above is unaffected.
 *
 * **`scope="col"` on every `<th>` (Milestone 5 Batch 13, M5-024
 * "Complete Dashboard Accessibility Pass")**: a real, found-not-assumed
 * gap under this task's own "Table semantics" Review item — without it,
 * a screen reader navigating cell-by-cell cannot announce which column a
 * given data cell belongs to (WCAG 1.3.1, Info and Relationships).
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

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs whitespace-nowrap text-muted-foreground">
              <th scope="col" className="pb-2 pr-4">
                Position
              </th>
              <th scope="col" className="pb-2 pr-4">
                Asset
              </th>
              <th scope="col" className="pb-2 pr-4">
                Quantity
              </th>
              <th scope="col" className="pb-2 pr-4">
                Current Price
              </th>
              <th scope="col" className="pb-2 pr-4">
                Value
              </th>
              <th scope="col" className="pb-2">
                Portfolio %
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label }) => {
              const row = composition[key];
              return (
                <tr key={key} className="border-t border-border whitespace-nowrap">
                  <td className="py-2 pr-4 text-foreground">{label}</td>
                  <td className="py-2 pr-4 text-foreground">{row.assetLabel}</td>
                  <td className="py-2 pr-4 text-foreground">{row.formattedQuantity}</td>
                  <td className="py-2 pr-4 text-foreground">{row.formattedCurrentPrice}</td>
                  <td className="py-2 pr-4 text-foreground">{row.formattedPositionValue}</td>
                  <td className="py-2 text-foreground">{row.formattedPortfolioPercentage}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {ROWS.map(({ key, label }) => (
          <CompactCard key={key} label={label} row={composition[key]} />
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Protocol Parameters</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground">
          {composition.protocolParameters.kind === 'v3' && (
            <>
              <span>Maximum LTV: {composition.protocolParameters.formattedMaxLoanToValue}</span>
              <span>
                Liquidation Threshold:{' '}
                {composition.protocolParameters.formattedLiquidationThreshold}
              </span>
            </>
          )}
          {composition.protocolParameters.kind === 'v4Available' && (
            <span>
              Collateral Factor: {composition.protocolParameters.formattedCollateralFactor}
            </span>
          )}
          {composition.protocolParameters.kind === 'v4Unavailable' && (
            <span>Collateral Factor: —</span>
          )}
          <span>Borrow APR: {composition.protocolParameters.formattedBorrowApr}</span>
          <span>Supply APR: {composition.protocolParameters.formattedSupplyApr}</span>
        </div>
      </div>
    </div>
  );
}

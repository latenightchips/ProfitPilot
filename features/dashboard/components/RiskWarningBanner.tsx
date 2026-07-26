import type { RiskWarning } from '../types/riskWarnings';

/**
 * Risk Warning Banner — 06_TASKS.md M5-010. DoD: "Each warning includes
 * a reason and recommended next action." Requirements: "Warnings must be
 * actionable. Warnings must not block valid analysis unnecessarily."
 *
 * Renders nothing when there are no active warnings — an empty banner
 * would itself violate "must not block valid analysis unnecessarily" by
 * occupying space with no information. See `../types/riskWarnings.ts`
 * for which 3 of the 6 documented "Warning cases" this covers.
 */
export function RiskWarningBanner({ warnings }: { warnings: RiskWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
    >
      <h3 className="text-sm font-medium text-foreground">Risk Warnings</h3>
      {warnings.map((warning) => (
        <div key={warning.code}>
          <p className="text-foreground">{warning.reason}</p>
          <p className="text-muted-foreground">{warning.recommendedAction}</p>
        </div>
      ))}
    </div>
  );
}

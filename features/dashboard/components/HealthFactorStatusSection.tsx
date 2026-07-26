import type { HealthFactorStatus } from '../types/healthFactorStatus';

/**
 * Health Factor Status Component — 06_TASKS.md M5-007. DoD: "The user
 * can understand both the numeric value and its practical meaning."
 *
 * Renders exactly the Display list this task names, minus "Risk
 * classification" (blocked by Conflict #1 — see
 * `../types/healthFactorStatus.ts`). "Formula reference in Developer
 * Mode" is a `title` tooltip on the Current Health Factor value, the
 * same minimal-baseline pattern `DashboardKpiGrid` (M5-006) already
 * established — no Developer Mode toggle exists anywhere in this
 * codebase yet (M5-022's own, later, still-unbuilt task).
 */
export function HealthFactorStatusSection({ status }: { status: HealthFactorStatus }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Health Factor Status</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div title="F-022 — see docs/02_Formulas.md">
          <div className="text-xs text-muted-foreground">Current Health Factor</div>
          <div className="text-base font-medium text-foreground">
            {status.formattedCurrentHealthFactor}
          </div>
        </div>

        {status.formattedConfiguredTarget !== null && (
          <div>
            <div className="text-xs text-muted-foreground">Configured Target</div>
            <div className="text-base font-medium text-foreground">
              {status.formattedConfiguredTarget}
            </div>
          </div>
        )}

        {status.formattedDistanceFromTarget !== null && (
          <div>
            <div className="text-xs text-muted-foreground">Distance From Target</div>
            <div className="text-base font-medium text-foreground">
              {status.formattedDistanceFromTarget}
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{status.explanation}</p>

      {status.requiredActions !== null && (
        <div>
          <p className="text-xs text-muted-foreground">Required action to restore target:</p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>{status.requiredActions.repayment}</li>
            <li>{status.requiredActions.additionalCollateral}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

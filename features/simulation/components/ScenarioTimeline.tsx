'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { useSimulationStore } from '@/stores/simulationStore';

import { formatCurrency, formatHealthFactor } from '../utils/format';

/**
 * Scenario Timeline — 06_TASKS.md M6-012 ("Implement Scenario Timeline").
 * Dependencies: M6-007. Description: "Display projected portfolio
 * evolution across the selected time horizon." DoD: "Users can visualize
 * projected changes over time." Priority P2, Effort M. Unlike M6-011,
 * M6-012 has no "Requirements" section in `06_TASKS.md` — the accessible/
 * responsive treatment below follows this feature's established practice
 * for internal consistency, not because M6-012 itself names it.
 *
 * **Reads `timelineProjection` (`stores/simulationStore.ts`, Batch 11)** —
 * 5 evenly-spaced points (0/25/50/75/100% of the active interest
 * scenario's own `timeHorizonDays`) computed by `runTimelineProjection`,
 * itself composed entirely from the already-public `simulateScenario`
 * Service call. See that Store's own header comment for why 5 points and
 * why only `type: 'interest'` scenarios populate it — this component
 * only renders what is already there; it computes nothing.
 *
 * **Empty state** covers both "no scenario yet" and "a price scenario is
 * active" (`timelineProjection === null` in both cases, per the Store's
 * own gating) — a single message is accurate for both, since price
 * scenarios genuinely have no time horizon to project across.
 *
 * **Line charts, not bar charts** — unlike `ScenarioCharts.tsx`
 * (Batch 10), which compares discrete saved scenarios side by side, this
 * is a single scenario's own values across a continuous day axis, so a
 * line chart is the accurate representation, not a stylistic choice.
 *
 * **Same "Accessible alternatives" pattern as `ScenarioCharts.tsx`**
 * (applied here as consistent practice, not a named M6-012 requirement):
 * each chart's container carries `role="img"` and a text `aria-label`
 * summarizing its own values, and `ScenarioSummary.tsx`'s existing
 * numeric display (rendered above this component on the page) remains
 * the primary, non-chart source for the endpoint values.
 *
 * **`isAnimationActive={false}` on every `<Line>` (M9-027 "Audit Motion
 * and Visual Stability")** — see `ScenarioCharts.tsx`'s own header
 * comment for why recharts' animation system needs disabling directly
 * rather than through `app/globals.css`'s `prefers-reduced-motion`
 * media query.
 */
const LINE_COLOR = 'var(--color-foreground, currentColor)';

/** Module-scoped `Intl` formatter singleton — see `features/dashboard/utils/format.ts`'s own header comment for why (M9-039, "Expensive formatting"). */
const dayFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function dayLabel(day: number): string {
  return `Day ${dayFormatter.format(day)}`;
}

function summarize(title: string, points: { name: string; value: string }[]): string {
  return `${title}: ${points.map((p) => `${p.name} ${p.value}`).join(', ')}`;
}

export function ScenarioTimeline() {
  const timelineProjection = useSimulationStore((state) => state.timelineProjection);

  /**
   * Memoized (M9-039, "Optimize Rendering Behavior" — "Chart rerenders")
   * — same rationale as `ScenarioCharts.tsx`'s own header comment.
   * `useMemo` must run before the `timelineProjection === null` early
   * return below (React hooks cannot be conditional), so each callback
   * handles the null case itself and returns an empty array rather than
   * skipping the hook call.
   */
  const equityData = useMemo(
    () =>
      (timelineProjection ?? []).map((point) => ({
        name: dayLabel(point.day),
        value: point.summary.equity,
      })),
    [timelineProjection],
  );
  const healthFactorData = useMemo(
    () =>
      (timelineProjection ?? []).map((point) => ({
        name: dayLabel(point.day),
        value: point.summary.healthFactor,
      })),
    [timelineProjection],
  );
  const interestData = useMemo(
    () =>
      (timelineProjection ?? []).map((point) => ({
        name: dayLabel(point.day),
        value: point.summary.debtCost,
      })),
    [timelineProjection],
  );

  if (timelineProjection === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Change Borrow Rate or Holding Period on an interest scenario to see the timeline.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="img"
        aria-label={summarize(
          'Portfolio Value Over Time',
          equityData.map((d) => ({ name: d.name, value: formatCurrency(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Portfolio Value Over Time</span>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={equityData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              dot
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        role="img"
        aria-label={summarize(
          'Health Factor Over Time',
          healthFactorData.map((d) => ({ name: d.name, value: formatHealthFactor(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Health Factor Over Time</span>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={healthFactorData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              dot
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        role="img"
        aria-label={summarize(
          'Interest Cost Over Time',
          interestData.map((d) => ({ name: d.name, value: formatCurrency(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Interest Cost Over Time</span>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={interestData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              dot
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Starting-Value Baseline Summary types — v1.20.0 Batch 1 (Dashboard
 * Starting-Value Baseline Visibility). Canonical specification:
 * `docs/STARTING_VALUE_BASELINE_SPEC.md`.
 *
 * Thin, Dashboard-owned display shape around
 * `calculateStartingValueBaselineComparison`'s own already-complete
 * `StartingValueBaselineComparison` result
 * (`services/portfolio/startingValueBaseline.ts`) — every field here is
 * either that result's own value, pre-formatted for direct render
 * (matching this feature's own `LeverageSummary` precedent: the builder
 * formats, the component only renders strings — see
 * `../utils/buildLeverageSummary.ts`), or a direct copy of its `status`
 * discriminant. No new financial arithmetic here or in
 * `../utils/buildStartingValueBaselineSummary.ts` — see that file's own
 * header comment.
 *
 * **`hasBaseline: false` is the only "no baseline" state** — mirrors
 * `calculateStartingValueBaselineComparison`'s own `null` return exactly
 * (spec §2/§10: the three baseline fields are only ever written
 * together, so "no baseline" is the one real absent state, not several).
 *
 * **No `setBaseline`/`resetBaseline` action lives here or on the
 * Dashboard.** Per this batch's own instruction, matching the "no
 * configuration surface on Dashboard" precedent
 * `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §9 already
 * established for Recommendation Preferences: baseline establishment
 * and reset stay on `app/portfolio/StartingValueBaselinePanel.tsx`; this
 * type carries no field or action that could mutate one.
 */
export interface StartingValueBaselineSummary {
  hasBaseline: boolean;
  /** Formatted baseline establishment date/time, or `null` when `hasBaseline` is `false`. */
  establishedAtFormatted: string | null;
  /** Formatted baseline value in USD, or `null` when `hasBaseline` is `false`. */
  baselineValueFormatted: string | null;
  /** Formatted current value in USD, or `null` when `hasBaseline` is `false`. */
  currentValueFormatted: string | null;
  /** Formatted absolute + percentage change (e.g. "+$20,000.00 (+20%)"), or `null` when `hasBaseline` is `false`. */
  changeFormatted: string | null;
  /** `true` iff the comparison's own `status` is `'compositionChanged'` (spec §5/§6) — always `false` when `hasBaseline` is `false`. */
  compositionChanged: boolean;
}

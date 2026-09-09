/**
 * CSV Exporter — 06_TASKS.md M8-039 ("Implement CSV Export"). Support:
 * "Portfolio positions, Scenario comparisons, Loop steps, Exit plan
 * breakdowns." Requirements: "Use stable column names. Include units.
 * Include timestamps and identifiers." DoD: "CSV files open cleanly in
 * common spreadsheet applications."
 *
 * **Collection-level, not the same job the 4 existing feature exporters
 * already do.** `features/loop-builder/utils/exportLoopStrategy.ts` (and
 * its 3 siblings) already export one CSV per currently-active record —
 * left fully intact per this batch's own instruction. This file's own
 * job is new: one CSV across every *saved* record of a kind at once
 * (e.g. every saved loop strategy's steps in one file), which nothing
 * before this batch could produce.
 *
 * **Reads `unknown` payloads structurally, never importing a Store's own
 * `SavedLoopStrategy`/`SavedExitPlan`/`SavedSimulation` type** — the same
 * dependency-direction discipline `JsonExporter.ts`'s own header comment
 * already established for this batch, and the same "loose but real"
 * precedent `services/persistence/schemas/strategy.schema.ts`'s own
 * `looseRecordSchema` already set for these exact nested Engine-result
 * shapes. A malformed or missing field renders as `'Not available'`
 * rather than throwing — a collection CSV must not fail outright because
 * one saved record is old or partially unsupported.
 *
 * **CSV formula-injection guard (06_TASKS.md M9-034 "Perform Input and
 * Output Sanitization Review") — found and fixed this batch.** A
 * user-controlled `Name` field (portfolio/strategy/scenario/exit-plan
 * name) beginning with `=`, `+`, `-`, `@`, tab, or carriage return can be
 * interpreted as a formula by Excel/Sheets when the CSV is opened —
 * `csvLine` below prefixes such a value with a leading `'` before it
 * ever reaches `csvEscape`, the standard CSV-injection mitigation.
 * Applied only to genuinely string-typed fields, checked *before*
 * `String(field)` stringification — a numeric field (e.g. a negative
 * debt balance, `-500`) is never routed through the guard, so a real
 * negative number's own leading `-` is never touched. Scoped narrowly:
 * this file's own IDs/asset-codes/ISO-timestamp strings are unaffected
 * in the overwhelming common case (none legitimately starts with one of
 * these characters), and the one field that could (`Name`) is exactly
 * the field this guard exists for.
 *
 * **"Debt Balance (USD)"/"Borrow APR" columns (V4 Readiness Audit §12
 * Stage 16)** — previously always `portfolio.debt.balance`/
 * `portfolio.protocol.borrowApr`, the legacy V3-shaped scalars, exported
 * as-is for every portfolio regardless of protocol version. For a V4
 * portfolio these can silently disagree with the real synced
 * `v4DebtState` (debt balance never reconciled by live sync; the borrow
 * rate has no defined relationship to V4's real two-parameter rate — see
 * `services/portfolio/mapping.ts`'s `resolveCanonicalDebtBalance`/
 * `deriveAaveV4EffectiveBorrowRate` for the full reasoning). Both columns
 * now resolve the real canonical value for V4, reusing those two
 * functions directly rather than any new math, and fall back to this
 * file's own existing `null` → `'Not available'` convention (`csvLine`
 * below) when `v4DebtState` is required but absent — never a silently
 * stale number in an exported financial record.
 *
 * **"Max LTV"/"Liquidation Threshold"/"Collateral Factor" columns (V4
 * Readiness Audit §12 Stage 23E)** — the two V3 columns previously
 * carried `portfolio.protocol.maxLoanToValue`/`.liquidationThreshold`
 * unconditionally for every row, a meaningless V3 pair for a V4 portfolio
 * (Stage 23B: `collateralFactor` alone governs both). A new "Collateral
 * Factor" column was added rather than reinterpreting either V3 column
 * for V4 rows — since this table spans every saved portfolio at once
 * (V3 and V4 rows together), the three columns coexist, each
 * `'Not available'` for whichever protocol version a given row doesn't
 * apply to. V3 rows' own two columns are populated exactly as before.
 *
 * **"Baseline Established At"/"Baseline Collateral Quantity (BTC)"/
 * "Baseline BTC Price (USD)" columns (v1.21.0 Batch 1, "Portfolio CSV
 * Export Field Completeness")** — appended after "Updated At", the
 * table's prior last column, the same placement convention every earlier
 * column-group addition to this function already used (P1-6 appended
 * after what was then the last column, "Supply APR"; P2-1 appended after
 * what was then the last column, "Gas Cost Assumption"). Read directly
 * and verbatim from `Portfolio.establishedAt`/`.collateralQuantity`/
 * `.marketPriceUsd` (`docs/STARTING_VALUE_BASELINE_SPEC.md` §2) — the
 * three raw, independently-optional baseline facts a portfolio may or
 * may not have, `undefined` on any portfolio with no baseline set (this
 * file's own existing `null` → `'Not available'` convention, via `?? null`).
 * **No comparison is computed here** — no current value, no change since
 * baseline, no percentage change. Those are derived, read-time-only
 * figures owned exclusively by `calculateStartingValueBaselineComparison`
 * (`services/portfolio/startingValueBaseline.ts`, v1.17.0), never
 * persisted and out of scope for a raw-field export like this one; this
 * closes exactly the gap `docs/STARTING_VALUE_BASELINE_SPEC.md` §16's own
 * acceptance criterion 11 named and explicitly deferred ("no other
 * export/import surface (CSV, etc.) is required to represent this
 * feature unless a future batch extends portfolio CSV export
 * generally"), and nothing beyond it.
 *
 * **"Minimum Health Factor for Borrowing"/"Target Debt Ratio Ceiling"/
 * "Loop Borrow Percentage"/"Maximum Acceptable Annual Interest Cost
 * (USD)" columns (v1.21.0 Batch 2, "Portfolio CSV Export Field
 * Completeness")** — appended after the three Batch 1 baseline columns,
 * the table's prior last columns, the same append-at-current-end
 * placement convention this function has used for every column-group
 * addition. Read directly and verbatim from
 * `Portfolio.settings.recommendationPreferences.borrow.userMinHealthFactor`/
 * `.targetDebtRatio` and `.loop.loopBorrowPercentage`/
 * `.maxAcceptableAnnualInterestCost`
 * (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §3/§4/§7) — four raw,
 * independently-optional preference values (spec §5's own partial-
 * configuration rule: `borrow`/`loop` being present does not imply both
 * of their own leaf fields are set), `undefined` when not configured
 * (this file's own `null` → `'Not available'` convention, via `?? null`).
 * Header wording follows this specification's own §7 "UI label" rows
 * verbatim (already reused unmodified by `app/portfolio/PortfolioPageClient.tsx`'s
 * own fieldset), adapted only to this file's own established Title Case
 * CSV-header convention and, for the one USD-denominated field, the same
 * "(USD)" unit-suffix convention already used elsewhere in this exact
 * header (e.g. "Debt Balance (USD)") — not the shorter, less precise
 * wording a prior roadmap audit had only provisionally suggested.
 * **No recommendation is evaluated here** — no actionability check, no
 * default, no preset, no fallback to `PortfolioSafetyTargets.targetHealthFactor`
 * (spec §3's own explicit note that `loop.targetHealthFactor` is
 * deliberately not a field here, since F-064 reuses that already-
 * persisted field instead). This closes exactly the gap
 * `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §16's own explicit
 * non-goal named and deferred ("Extend CSV portfolio export to include
 * `safetyTargets`/`recommendationPreferences` (§4)"), and nothing beyond
 * it — `safetyTargets` itself remains out of this batch's own scope,
 * unaffected.
 *
 * **"Target Health Factor"/"Holding Period (Days)"/"Target BTC Price
 * (USD)"/"Safety Buffer (%)" columns (v1.22.0 Batch 1, "Portfolio CSV
 * Export Completeness, Part 2")** — appended after the four Batch 2
 * preference columns, the table's prior last columns, the same
 * append-at-current-end placement convention this function has used
 * for every column-group addition. Read directly and verbatim from
 * `Portfolio.settings.safetyTargets.targetHealthFactor`/
 * `.holdingPeriodDays`/`.targetBtcPriceUsd`/`.safetyBufferPercent`
 * (`types/portfolio.ts`'s `PortfolioSafetyTargets`) — four raw,
 * independently-optional values, each `?? null` (this file's own
 * `null` → `'Not available'` convention), never treated as an
 * all-or-nothing group. Header wording follows the canonical labels
 * already used by `app/portfolio/PortfolioPageClient.tsx`'s own "Safety
 * target settings" fieldset ("Target Health Factor," "Holding period
 * (days)," "Target BTC price (USD)," "Safety buffer (%)"), adapted only
 * to this file's own established Title Case CSV-header convention. This
 * closes exactly the other half of the gap
 * `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §16's own explicit
 * non-goal named ("Extend CSV portfolio export to include
 * `safetyTargets`/`recommendationPreferences` (§4)") — `v1.21.0` closed
 * the `recommendationPreferences` half; this batch closes the
 * `safetyTargets` half. **No arithmetic, no default, no fallback.**
 * `holdingPeriodDays`/`safetyBufferPercent` both validate `nonnegative()`
 * (`types/portfolio.schema.ts`'s `portfolioSafetyTargetsSchema`) — `0`
 * is a genuinely valid configured value for both and must render as
 * `'0'`, never `'Not available'` (the existing `?? null` pattern
 * already guarantees this, since `??` only substitutes on `null`/
 * `undefined`, never on `0`). `targetHealthFactor`/`targetBtcPriceUsd`
 * both validate `positive()` — they have no valid zero case, and none
 * is invented here.
 */
import {
  deriveAaveV4EffectiveBorrowRate,
  resolveCanonicalDebtBalance,
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
} from '@/services/portfolio/mapping';
import { resolveExportProvenance } from '@/services/shared/exportProvenance';
import type { Portfolio } from '@/types/portfolio';

/** No real Engine call precedes this export — the same "first call, no prior tracked version" case `services/recommendation/recommendations.ts` already established for this same function. */
const EXPORT_SOURCE_STATUS = 'export';

function resolveDebtBalanceForExport(portfolio: Portfolio): number | null {
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState === undefined) return null;
  return resolveCanonicalDebtBalance(portfolio);
}

function resolveBorrowAprForExport(portfolio: Portfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') return portfolio.protocol.borrowApr;
  if (portfolio.v4DebtState === undefined) return null;
  const rateStep = deriveAaveV4EffectiveBorrowRate(
    portfolio.v4DebtState,
    null,
    EXPORT_SOURCE_STATUS,
  );
  return rateStep.ok ? rateStep.value : null;
}

/**
 * "Max LTV"/"Liquidation Threshold"/"Collateral Factor" columns — V4
 * Readiness Audit §12 Stage 23E. Previously always `portfolio.protocol.
 * maxLoanToValue`/`.liquidationThreshold`, unconditionally, for every row
 * regardless of protocol version — a meaningless V3 pair for a V4
 * portfolio (Stage 23B: `collateralFactor` alone governs both). Since
 * this is a single fixed-column table spanning every saved portfolio
 * (V3 and V4 rows can appear together), the two V3 columns and the one
 * new V4 column all exist side by side, each `'Not available'` (this
 * file's own existing `null` -> `'Not available'` convention) for
 * whichever protocol version a given row doesn't apply to — never a
 * reinterpreted V3 field for a V4 row, and V3 rows' own two columns are
 * populated exactly as before.
 */
function resolveMaxLoanToValueForExport(portfolio: Portfolio): number | null {
  const display = resolveRiskCapacityDisplay(portfolio);
  return display.kind === 'v3' ? display.maxLoanToValue : null;
}

function resolveLiquidationThresholdForExport(portfolio: Portfolio): number | null {
  const display = resolveRiskCapacityDisplay(portfolio);
  return display.kind === 'v3' ? display.liquidationThreshold : null;
}

function resolveCollateralFactorForExport(portfolio: Portfolio): number | null {
  const display = resolveRiskCapacityDisplay(portfolio);
  return display.kind === 'v4Available' ? display.collateralFactor : null;
}

/**
 * "Supply APR" column — V4 Readiness Audit §12 P1-1. Previously always
 * `portfolio.protocol.supplyApr` unconditionally for every row — for a
 * live V4 portfolio this could be a stale leftover from before the
 * portfolio became V4, never a real V4 value (no V4 boundary this
 * codebase talks to exposes an authoritative supply rate at all — see
 * `resolveSupplyAprDisplay`'s own doc comment,
 * `services/portfolio/mapping.ts`). `null` (this file's own existing
 * `null` -> `'Not available'` convention) rather than a stale/fabricated
 * number.
 */
function resolveSupplyAprForExport(portfolio: Portfolio): number | null {
  const display = resolveSupplyAprDisplay(portfolio);
  return display.kind === 'available' ? display.supplyApr : null;
}

/**
 * "Swap Fee Assumption" / "Slippage Assumption" / "Gas Cost Assumption"
 * columns — V4 Readiness Audit §12 P1-6. Read directly from
 * `portfolio.settings.executionCostAssumptions` (this file already
 * operates on the full `Portfolio[]`, unlike most Loop/Exit consumers
 * which only see `ApplicationPortfolio`) — each independently `null`
 * (this file's own `null` → `'Not available'` convention) when not
 * configured, never a fabricated `0`.
 */

/**
 * "Protocol Version" / "V4 Debt State Source" / "V4 Debt State Updated At" /
 * "V4 Collateral Risk Source" / "V4 Collateral Risk Updated At" /
 * "V4 Data Stale At Export" columns — V4 Readiness Audit §12 P2-1
 * (`buildPortfolioPositionsCsv` below), extended to the three
 * collection-level exports (`buildScenarioComparisonsCsv`/
 * `buildLoopStepsCsv`/`buildExitPlanBreakdownsCsv`) in P2-2. Reuse
 * `resolveExportProvenance` (`services/shared/exportProvenance.ts`)
 * directly — the same shared resolver every exporter calls, rather than a
 * fifth independent copy of the same "manual vs live, last successful
 * timestamp, stale at export" logic.
 *
 * **Why P2-2, not already part of P2-1**: `buildScenarioComparisonsCsv`/
 * `buildLoopStepsCsv`/`buildExitPlanBreakdownsCsv` each operate on a
 * saved simulation/loop-strategy/exit-plan record — structurally typed
 * `unknown`, not `Portfolio` — and a saved record carries only its own
 * `portfolioId` string, never the owning portfolio's protocol version or
 * V4 source/freshness fields. Resolving real provenance for these three
 * exports requires cross-referencing each record's `portfolioId` against
 * a portfolios list, which `ExportService.ts`'s `exportCsv` now fetches
 * only for these three kinds (`services/portfolio/index` still owns
 * nothing about it — this stays a plain `Portfolio[]` lookup, no new
 * dependency).
 *
 * **Never a fabricated value.** A `portfolioId` that doesn't resolve to
 * any currently-saved portfolio (deleted since the record was saved, or a
 * malformed/missing id on the loosely-typed record) reports every
 * provenance column as `null` → `'Not available'` — a real "we do not
 * know," never a guess and never silently `'v3'`.
 */
function buildPortfolioLookup(portfolios: Portfolio[]): Map<string, Portfolio> {
  return new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
}

function resolvePortfolioProvenanceColumns(
  portfolioId: string | null,
  portfoliosById: Map<string, Portfolio>,
): (string | boolean | null)[] {
  const portfolio = portfolioId !== null ? portfoliosById.get(portfolioId) : undefined;
  if (portfolio === undefined) {
    return [null, null, null, null, null, null, null, null, null];
  }
  const provenance = resolveExportProvenance(portfolio);
  return [
    provenance.protocolVersion,
    provenance.v4DebtStateSource,
    provenance.v4DebtStateUpdatedAt,
    provenance.v4CollateralRiskSource,
    provenance.v4CollateralRiskUpdatedAt,
    // V4 Mixed-Provenance UX batch — see `ExportProvenance`'s own doc
    // comment (`services/shared/exportProvenance.ts`) for what each new
    // field means and why `marketSource`/`v4BaseDrawnAprSource` were
    // missing before this batch.
    provenance.v4BaseDrawnAprSource,
    provenance.marketSource,
    provenance.marketUpdatedAt,
    provenance.v4DataStaleAtExport,
  ];
}

const PROVENANCE_COLUMN_HEADERS = [
  'Protocol Version',
  'V4 Debt State Source',
  'V4 Debt State Updated At',
  'V4 Collateral Risk Source',
  'V4 Collateral Risk Updated At',
  'V4 Base Drawn APR Source',
  'Market Data Source',
  'Market Data Updated At',
  'V4 Data Stale At Export',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

function guardFormulaInjection(value: string): string {
  return FORMULA_TRIGGER_PATTERN.test(value) ? `'${value}` : value;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(fields: (string | number | boolean | null)[]): string {
  return fields
    .map((field) => {
      if (field === null) return 'Not available';
      const stringValue = typeof field === 'string' ? guardFormulaInjection(field) : String(field);
      return csvEscape(stringValue);
    })
    .join(',');
}

export function buildPortfolioPositionsCsv(portfolios: Portfolio[]): string {
  const header = csvLine([
    'Portfolio ID',
    'Name',
    'Collateral Asset',
    'Collateral Quantity (BTC)',
    'Debt Asset',
    'Debt Balance (USD)',
    'BTC Price (USD)',
    'Max LTV',
    'Liquidation Threshold',
    'Collateral Factor',
    'Borrow APR',
    'Supply APR',
    'Swap Fee Assumption',
    'Slippage Assumption',
    'Gas Cost Assumption',
    'Protocol Version',
    'V4 Debt State Source',
    'V4 Debt State Updated At',
    'V4 Collateral Risk Source',
    'V4 Collateral Risk Updated At',
    'V4 Base Drawn APR Source',
    'Market Data Source',
    'Market Data Updated At',
    'V4 Data Stale At Export',
    'Archived',
    'Created At',
    'Updated At',
    'Baseline Established At',
    'Baseline Collateral Quantity (BTC)',
    'Baseline BTC Price (USD)',
    'Minimum Health Factor for Borrowing',
    'Target Debt Ratio Ceiling',
    'Loop Borrow Percentage',
    'Maximum Acceptable Annual Interest Cost (USD)',
    'Target Health Factor',
    'Holding Period (Days)',
    'Target BTC Price (USD)',
    'Safety Buffer (%)',
  ]);

  const rows = portfolios.map((portfolio) => {
    const provenance = resolveExportProvenance(portfolio);
    return csvLine([
      portfolio.id,
      portfolio.name,
      portfolio.collateral.asset,
      portfolio.collateral.quantity,
      portfolio.debt.asset,
      resolveDebtBalanceForExport(portfolio),
      portfolio.market.btcPriceUsd,
      resolveMaxLoanToValueForExport(portfolio),
      resolveLiquidationThresholdForExport(portfolio),
      resolveCollateralFactorForExport(portfolio),
      resolveBorrowAprForExport(portfolio),
      resolveSupplyAprForExport(portfolio),
      portfolio.settings.executionCostAssumptions?.swapFeeRate ?? null,
      portfolio.settings.executionCostAssumptions?.slippageRate ?? null,
      portfolio.settings.executionCostAssumptions?.gasCostUsd ?? null,
      provenance.protocolVersion,
      provenance.v4DebtStateSource,
      provenance.v4DebtStateUpdatedAt,
      provenance.v4CollateralRiskSource,
      provenance.v4CollateralRiskUpdatedAt,
      provenance.v4BaseDrawnAprSource,
      provenance.marketSource,
      provenance.marketUpdatedAt,
      provenance.v4DataStaleAtExport,
      portfolio.archivedAt !== null,
      portfolio.createdAt,
      portfolio.updatedAt,
      portfolio.establishedAt ?? null,
      portfolio.collateralQuantity ?? null,
      portfolio.marketPriceUsd ?? null,
      portfolio.settings.recommendationPreferences?.borrow?.userMinHealthFactor ?? null,
      portfolio.settings.recommendationPreferences?.borrow?.targetDebtRatio ?? null,
      portfolio.settings.recommendationPreferences?.loop?.loopBorrowPercentage ?? null,
      portfolio.settings.recommendationPreferences?.loop?.maxAcceptableAnnualInterestCost ?? null,
      portfolio.settings.safetyTargets?.targetHealthFactor ?? null,
      portfolio.settings.safetyTargets?.holdingPeriodDays ?? null,
      portfolio.settings.safetyTargets?.targetBtcPriceUsd ?? null,
      portfolio.settings.safetyTargets?.safetyBufferPercent ?? null,
    ]);
  });

  return [header, ...rows].join('\n');
}

export function buildScenarioComparisonsCsv(scenarios: unknown[], portfolios: Portfolio[]): string {
  const header = csvLine([
    'Simulation ID',
    'Name',
    'Portfolio ID',
    'Scenario Type',
    'Baseline Equity (USD)',
    'Scenario Equity (USD)',
    'Baseline Health Factor',
    'Scenario Health Factor',
    'Profit or Loss (USD)',
    'Created At',
    ...PROVENANCE_COLUMN_HEADERS,
  ]);

  const portfoliosById = buildPortfolioLookup(portfolios);

  const rows = scenarios.map((raw) => {
    const record = asRecord(raw);
    const result = asRecord(record?.result);
    const baseline = asRecord(result?.baseline);
    const scenario = asRecord(result?.scenario);
    const scenarioDefinition = asRecord(record?.scenario);
    const portfolioId = asString(record?.portfolioId);

    return csvLine([
      asString(record?.id) ?? 'Not available',
      asString(record?.name) ?? 'Not available',
      portfolioId ?? 'Not available',
      asString(scenarioDefinition?.type),
      asNumber(baseline?.equity),
      asNumber(scenario?.equity),
      asNumber(baseline?.healthFactor),
      asNumber(scenario?.healthFactor),
      asNumber(scenario?.profitOrLoss),
      asString(record?.createdAt) ?? 'Not available',
      ...resolvePortfolioProvenanceColumns(portfolioId, portfoliosById),
    ]);
  });

  return [header, ...rows].join('\n');
}

export function buildLoopStepsCsv(strategies: unknown[], portfolios: Portfolio[]): string {
  const header = csvLine([
    'Strategy ID',
    'Strategy Name',
    'Portfolio ID',
    'Step Number',
    'Borrowed Amount (USD)',
    'BTC Purchased (BTC)',
    'Collateral After (BTC)',
    'Created At',
    ...PROVENANCE_COLUMN_HEADERS,
  ]);

  const portfoliosById = buildPortfolioLookup(portfolios);

  const rows: string[] = [];
  for (const raw of strategies) {
    const record = asRecord(raw);
    const id = asString(record?.id) ?? 'Not available';
    const name = asString(record?.name) ?? 'Not available';
    const portfolioId = asString(record?.portfolioId);
    const createdAt = asString(record?.createdAt) ?? 'Not available';
    const provenanceColumns = resolvePortfolioProvenanceColumns(portfolioId, portfoliosById);

    const result = asRecord(record?.result);
    const strategy = asRecord(result?.strategy);
    const steps = Array.isArray(strategy?.steps) ? (strategy.steps as unknown[]) : [];

    if (steps.length === 0) {
      rows.push(
        csvLine([
          id,
          name,
          portfolioId ?? 'Not available',
          null,
          null,
          null,
          null,
          createdAt,
          ...provenanceColumns,
        ]),
      );
      continue;
    }

    for (const rawStep of steps) {
      const step = asRecord(rawStep);
      const collateralAfter = asRecord(step?.collateralAfter);
      rows.push(
        csvLine([
          id,
          name,
          portfolioId ?? 'Not available',
          asNumber(step?.stepNumber),
          asNumber(step?.borrowedAmount),
          asNumber(step?.btcPurchased),
          asNumber(collateralAfter?.quantity),
          createdAt,
          ...provenanceColumns,
        ]),
      );
    }
  }

  return [header, ...rows].join('\n');
}

export function buildExitPlanBreakdownsCsv(plans: unknown[], portfolios: Portfolio[]): string {
  const header = csvLine([
    'Plan ID',
    'Plan Name',
    'Portfolio ID',
    'Exit Type',
    'Feasible',
    'Net Equity Before (USD)',
    'Net Equity After (USD)',
    'Repayment (USD)',
    'BTC Sold',
    'BTC Retained',
    'Created At',
    ...PROVENANCE_COLUMN_HEADERS,
  ]);

  const portfoliosById = buildPortfolioLookup(portfolios);

  const rows = plans.map((raw) => {
    const record = asRecord(raw);
    const result = asRecord(record?.result);
    const before = asRecord(result?.before);
    const after = asRecord(result?.after);
    const transaction = asRecord(result?.transaction);
    const portfolioId = asString(record?.portfolioId);

    return csvLine([
      asString(record?.id) ?? 'Not available',
      asString(record?.name) ?? 'Not available',
      portfolioId ?? 'Not available',
      asString(record?.exitType) ?? 'Not available',
      typeof result?.feasible === 'boolean' ? result.feasible : null,
      asNumber(before?.netEquity),
      asNumber(after?.netEquity),
      asNumber(transaction?.repayment),
      asNumber(transaction?.btcSold),
      asNumber(transaction?.btcRetained),
      asString(record?.createdAt) ?? 'Not available',
      ...resolvePortfolioProvenanceColumns(portfolioId, portfoliosById),
    ]);
  });

  return [header, ...rows].join('\n');
}

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
 */
import {
  deriveAaveV4EffectiveBorrowRate,
  resolveCanonicalDebtBalance,
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
} from '@/services/portfolio/mapping';
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
    'Archived',
    'Created At',
    'Updated At',
  ]);

  const rows = portfolios.map((portfolio) =>
    csvLine([
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
      portfolio.archivedAt !== null,
      portfolio.createdAt,
      portfolio.updatedAt,
    ]),
  );

  return [header, ...rows].join('\n');
}

export function buildScenarioComparisonsCsv(scenarios: unknown[]): string {
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
  ]);

  const rows = scenarios.map((raw) => {
    const record = asRecord(raw);
    const result = asRecord(record?.result);
    const baseline = asRecord(result?.baseline);
    const scenario = asRecord(result?.scenario);
    const scenarioDefinition = asRecord(record?.scenario);

    return csvLine([
      asString(record?.id) ?? 'Not available',
      asString(record?.name) ?? 'Not available',
      asString(record?.portfolioId) ?? 'Not available',
      asString(scenarioDefinition?.type),
      asNumber(baseline?.equity),
      asNumber(scenario?.equity),
      asNumber(baseline?.healthFactor),
      asNumber(scenario?.healthFactor),
      asNumber(scenario?.profitOrLoss),
      asString(record?.createdAt) ?? 'Not available',
    ]);
  });

  return [header, ...rows].join('\n');
}

export function buildLoopStepsCsv(strategies: unknown[]): string {
  const header = csvLine([
    'Strategy ID',
    'Strategy Name',
    'Portfolio ID',
    'Step Number',
    'Borrowed Amount (USD)',
    'BTC Purchased (BTC)',
    'Collateral After (BTC)',
    'Created At',
  ]);

  const rows: string[] = [];
  for (const raw of strategies) {
    const record = asRecord(raw);
    const id = asString(record?.id) ?? 'Not available';
    const name = asString(record?.name) ?? 'Not available';
    const portfolioId = asString(record?.portfolioId) ?? 'Not available';
    const createdAt = asString(record?.createdAt) ?? 'Not available';

    const result = asRecord(record?.result);
    const strategy = asRecord(result?.strategy);
    const steps = Array.isArray(strategy?.steps) ? (strategy.steps as unknown[]) : [];

    if (steps.length === 0) {
      rows.push(csvLine([id, name, portfolioId, null, null, null, null, createdAt]));
      continue;
    }

    for (const rawStep of steps) {
      const step = asRecord(rawStep);
      const collateralAfter = asRecord(step?.collateralAfter);
      rows.push(
        csvLine([
          id,
          name,
          portfolioId,
          asNumber(step?.stepNumber),
          asNumber(step?.borrowedAmount),
          asNumber(step?.btcPurchased),
          asNumber(collateralAfter?.quantity),
          createdAt,
        ]),
      );
    }
  }

  return [header, ...rows].join('\n');
}

export function buildExitPlanBreakdownsCsv(plans: unknown[]): string {
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
  ]);

  const rows = plans.map((raw) => {
    const record = asRecord(raw);
    const result = asRecord(record?.result);
    const before = asRecord(result?.before);
    const after = asRecord(result?.after);
    const transaction = asRecord(result?.transaction);

    return csvLine([
      asString(record?.id) ?? 'Not available',
      asString(record?.name) ?? 'Not available',
      asString(record?.portfolioId) ?? 'Not available',
      asString(record?.exitType) ?? 'Not available',
      typeof result?.feasible === 'boolean' ? result.feasible : null,
      asNumber(before?.netEquity),
      asNumber(after?.netEquity),
      asNumber(transaction?.repayment),
      asNumber(transaction?.btcSold),
      asNumber(transaction?.btcRetained),
      asString(record?.createdAt) ?? 'Not available',
    ]);
  });

  return [header, ...rows].join('\n');
}

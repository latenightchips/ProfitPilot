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
 */
import type { Portfolio } from '@/types/portfolio';

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
      portfolio.debt.balance,
      portfolio.market.btcPriceUsd,
      portfolio.protocol.maxLoanToValue,
      portfolio.protocol.liquidationThreshold,
      portfolio.protocol.borrowApr,
      portfolio.protocol.supplyApr,
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

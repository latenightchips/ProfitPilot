import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildLoopStrategyExportCsv,
  buildLoopStrategyExportJson,
  buildLoopStrategyExportPayload,
  downloadLoopStrategyExport,
  LOOP_EXPORT_SCHEMA_VERSION,
} from '@/features/loop-builder';
import {
  type ApplicationPortfolio,
  deriveAaveV4EffectiveBorrowRate,
  type LoopStrategyPreview,
  type ServiceMetadata,
} from '@/services';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { StrategyWarning } from '@/types/strategy';

/**
 * Loop Strategy Export — 06_TASKS.md M7-018. DoD: "Exported strategies
 * are reproducible." Every payload built below comes from a real
 * `LoopStrategyPreview` produced by the actual Store actions, never a
 * hand-crafted mock result — matching this whole milestone's own
 * established testing convention.
 */
const PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 1 },
  debt: { asset: 'USDC', balance: 0 },
  market: { btcPriceUsd: 50000 },
  protocol: {
    maxLoanToValue: 0.5,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

const SETTINGS: LoopStrategySettings = {
  targetBorrowPercentage: 0.5,
  maxLoops: 3,
  minHealthFactor: 1.1,
};

function runViableStrategy(): {
  result: LoopStrategyPreview;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
} {
  useLoopBuilderStore.getState().reset();
  useLoopBuilderStore.getState().setSettings(SETTINGS);
  useLoopBuilderStore.getState().runLoopStrategy(PORTFOLIO);
  const state = useLoopBuilderStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return { result: state.currentResult, warnings: state.warnings, metadata: state.lastMetadata };
}

function runNonViableStrategy(): {
  result: LoopStrategyPreview;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
} {
  const atLiquidation: ApplicationPortfolio = {
    ...PORTFOLIO,
    debt: { asset: 'USDC', balance: 9000 },
    market: { btcPriceUsd: 10000 },
  };
  useLoopBuilderStore.getState().reset();
  useLoopBuilderStore.getState().setSettings(SETTINGS);
  useLoopBuilderStore.getState().runLoopStrategy(atLiquidation);
  const state = useLoopBuilderStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return { result: state.currentResult, warnings: state.warnings, metadata: state.lastMetadata };
}

describe('buildLoopStrategyExportPayload', () => {
  it('includes the schema version, exact inputs, step results, final outcome, costs, and warnings', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    expect(payload.schemaVersion).toBe(LOOP_EXPORT_SCHEMA_VERSION);
    expect(payload.inputs).toEqual(SETTINGS);
    expect(payload.stepResults).toEqual(result.strategy?.steps);
    expect(payload.finalOutcome).not.toBeNull();
    expect(payload.finalOutcome?.stopReason).toBe(result.strategy?.stopReason);
    expect(payload.costs).toEqual(result.costs);
    expect(payload.monthlyInterestCost).toEqual(result.monthlyInterestCost);
    expect(payload.remainingBorrowCapacity).toEqual(result.remainingBorrowCapacity);
    expect(payload.warnings).toEqual(warnings);
  });

  it('includes real protocol assumptions and the documented fees & slippage note', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    expect(payload.assumptions.protocolParameters).toEqual({
      ...PORTFOLIO.protocol,
      collateralFactor: null,
    });
    expect(payload.assumptions.feesAndSlippage).toMatch(/Formula ID/);
  });

  it('reports timestamp/versions as null, not fabricated, when metadata is unavailable', () => {
    const { result, warnings } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, null, PORTFOLIO);

    expect(payload.timestamp).toBeNull();
    expect(payload.versions).toBeNull();
  });

  it('reports an empty step list and null finalOutcome/costs for a non-viable strategy', () => {
    const { result, warnings, metadata } = runNonViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    expect(payload.stepResults).toEqual([]);
    expect(payload.finalOutcome).toBeNull();
    expect(payload.costs).toBeNull();
    expect(payload.monthlyInterestCost).toBeNull();
    expect(payload.remainingBorrowCapacity).toBeNull();
  });
});

describe('buildLoopStrategyExportJson', () => {
  it('produces valid, pretty-printed JSON that round-trips to the same payload', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    const json = buildLoopStrategyExportJson(payload);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual(payload);
  });
});

describe('buildLoopStrategyExportCsv', () => {
  it('produces a Field,Value table including inputs, step rows, final outcome, and costs', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    const csv = buildLoopStrategyExportCsv(payload);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Field,Value');
    expect(csv).toContain('Target Borrow Percentage,0.5');
    expect(csv).toContain('Step 1 Borrowed Amount');
    expect(csv).toContain(`Final Debt,${payload.finalOutcome?.finalDebt}`);
    expect(csv).toContain(`Annual Interest Cost,${payload.costs?.borrowingInterest}`);
    expect(csv).toContain(`Engine Version,${metadata?.engineVersion}`);
  });

  it('includes override rows only when overrides are actually supplied', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const overriddenSettings: LoopStrategySettings = {
      ...SETTINGS,
      maxLoanToValueOverride: 0.4,
      borrowAprOverride: 0.2,
    };
    const payload = buildLoopStrategyExportPayload(
      overriddenSettings,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Max LTV Override,0.4');
    expect(csv).toContain('Borrow APR Override,0.2');

    const withoutOverrides = buildLoopStrategyExportCsv(
      buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO),
    );
    expect(withoutOverrides).not.toContain('Max LTV Override');
    expect(withoutOverrides).not.toContain('Borrow APR Override');
  });

  it('shows "Not available" and omits Final Debt for a non-viable strategy export', () => {
    const { result, warnings, metadata } = runNonViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Final Outcome,Not available — the strategy is not viable.');
    expect(csv).toContain('Costs,Not available — the strategy is not viable.');
    expect(csv).not.toContain('Final Debt');
  });

  it('comma-escapes a warning cause containing a comma', () => {
    const { result, metadata } = runViableStrategy();
    const warnings: StrategyWarning[] = [
      {
        category: 'safety',
        severity: 'warning',
        cause: 'A cause, with a comma',
        suggestedResponse: 'Respond.',
      },
    ];
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('"warning: A cause, with a comma"');
  });

  it('shows "Not captured" instead of fabricating a value when metadata is unavailable', () => {
    const { result, warnings } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, null, PORTFOLIO);

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Timestamp,Not captured');
    expect(csv).toContain('Engine Version,Not captured');
    expect(csv).toContain('Formula Version,Not captured');
  });
});

/**
 * "Borrow APR (Protocol)" for a V4 portfolio — V4 Readiness Audit §12
 * Stage 22. `protocol.borrowApr` deliberately disagrees with the real
 * synced `v4DebtState` below, proving the export uses the canonical
 * effective rate (`deriveAaveV4EffectiveBorrowRate`), never the raw
 * legacy scalar — the same fixture discipline Stage 20/21's own V4 rate
 * tests already established.
 */
describe('buildLoopStrategyExportPayload — V4 canonical Borrow APR (Stage 22)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocol: { ...PORTFOLIO.protocol, borrowApr: 0.99 },
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
    // Stage 23E's collateral-risk guard now requires this on every V4
    // portfolio, in addition to v4DebtState.
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
  };

  function runV4ViableStrategy(): {
    result: LoopStrategyPreview;
    warnings: ReturnType<typeof useLoopBuilderStore.getState>['warnings'];
    metadata: ServiceMetadata | null;
  } {
    useLoopBuilderStore.getState().reset();
    useLoopBuilderStore.getState().setSettings(SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(V4_PORTFOLIO);
    const state = useLoopBuilderStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, warnings: state.warnings, metadata: state.lastMetadata };
  }

  it('exports the canonical effective V4 rate, never the raw 99% legacy scalar', () => {
    const { result, warnings, metadata } = runV4ViableStrategy();
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      V4_PORTFOLIO,
    );

    const rateStep = deriveAaveV4EffectiveBorrowRate(V4_PORTFOLIO.v4DebtState!, null, 'export');
    if (!rateStep.ok) throw new Error('setup failed: expected a valid effective rate');
    expect(payload.assumptions.protocolParameters.borrowApr).toBeCloseTo(rateStep.value);
    expect(payload.assumptions.protocolParameters.borrowApr).not.toBe(0.99);

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).not.toContain('Borrow APR (Protocol),0.99');
  });

  it('never falls back to the legacy scalar when v4DebtState is unavailable — exports null (JSON) / "Not available" (CSV)', () => {
    const { result, warnings, metadata } = runV4ViableStrategy();
    const portfolioMissingDebtState: ApplicationPortfolio = {
      ...V4_PORTFOLIO,
      v4DebtState: undefined,
    };
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      portfolioMissingDebtState,
    );

    expect(payload.assumptions.protocolParameters.borrowApr).toBeNull();
    expect(payload.assumptions.protocolParameters.borrowApr).not.toBe(0.99);

    const json = buildLoopStrategyExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.borrowApr).toBeNull();

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Borrow APR (Protocol),Not available');
    expect(csv).not.toContain('Borrow APR (Protocol),0.99');
  });

  it('a V3 (or unset) portfolio is completely unaffected — protocolParameters still equals the raw portfolio.protocol', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);
    expect(payload.assumptions.protocolParameters).toEqual({
      ...PORTFOLIO.protocol,
      collateralFactor: null,
    });
  });
});

/**
 * "Supply APR" — V4 Readiness Audit §12 P1-1. No V4 boundary this
 * codebase talks to exposes an authoritative supply rate, so a live V4
 * portfolio must never export the inherited/leftover `protocol.supplyApr`
 * figure. `protocol.supplyApr: 0.045` deliberately non-zero and distinct
 * from `PORTFOLIO`'s own `0.02`, the same fixture discipline the Borrow
 * APR block above already established.
 */
describe('buildLoopStrategyExportPayload — Supply APR (P1-1)', () => {
  const LIVE_V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocol: { ...PORTFOLIO.protocol, supplyApr: 0.045 },
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    v4CollateralRiskSource: 'live',
  };

  function runV4Strategy(portfolio: ApplicationPortfolio): {
    result: LoopStrategyPreview;
    warnings: StrategyWarning[];
    metadata: ServiceMetadata | null;
  } {
    useLoopBuilderStore.getState().reset();
    useLoopBuilderStore.getState().setSettings(SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const state = useLoopBuilderStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, warnings: state.warnings, metadata: state.lastMetadata };
  }

  it('exports null (JSON) / "Not available" (CSV) for a live V4 portfolio, never the leftover 0.045 figure', () => {
    const { result, warnings, metadata } = runV4Strategy(LIVE_V4_PORTFOLIO);
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      LIVE_V4_PORTFOLIO,
    );

    expect(payload.assumptions.protocolParameters.supplyApr).toBeNull();

    const json = buildLoopStrategyExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.supplyApr).toBeNull();

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Supply APR,Not available');
    expect(csv).not.toContain('Supply APR,0.045');
  });

  it('exports null for a V4 portfolio with no v4CollateralRiskSource yet', () => {
    const { result, warnings, metadata } = runV4Strategy(LIVE_V4_PORTFOLIO);
    const notYetSynced: ApplicationPortfolio = {
      ...LIVE_V4_PORTFOLIO,
      v4CollateralRisk: undefined,
      v4CollateralRiskSource: undefined,
    };
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      notYetSynced,
    );
    expect(payload.assumptions.protocolParameters.supplyApr).toBeNull();
  });

  it('exports the real protocol.supplyApr for manual V4 — manual semantics preserved', () => {
    const manualV4: ApplicationPortfolio = {
      ...LIVE_V4_PORTFOLIO,
      v4CollateralRiskSource: 'manual',
    };
    const { result, warnings, metadata } = runV4Strategy(manualV4);
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, manualV4);
    expect(payload.assumptions.protocolParameters.supplyApr).toBe(0.045);
  });

  it('a V3 (or unset) portfolio is completely unaffected — still exports the real protocol.supplyApr', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const payload = buildLoopStrategyExportPayload(SETTINGS, result, warnings, metadata, PORTFOLIO);
    expect(payload.assumptions.protocolParameters.supplyApr).toBe(0.02);
  });
});

/**
 * "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
 * Readiness Audit §12 Stage 23E. `collateralFactor: 0.65` deliberately
 * differs from `PORTFOLIO`'s own `protocol.liquidationThreshold: 0.8`, so
 * a test that silently used the V3 field would fail on an exact numeric
 * mismatch.
 */
describe('buildLoopStrategyExportPayload — V4 risk-capacity export (Stage 23E)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
    v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
  };

  function runV4Strategy(portfolio: ApplicationPortfolio) {
    useLoopBuilderStore.getState().reset();
    useLoopBuilderStore.getState().setSettings(SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const state = useLoopBuilderStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, warnings: state.warnings, metadata: state.lastMetadata };
  }

  it('exports maxLoanToValue/liquidationThreshold as null and the real collateralFactor for a V4 portfolio, never a reinterpreted V3 field', () => {
    const { result, warnings, metadata } = runV4Strategy(V4_PORTFOLIO);
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      V4_PORTFOLIO,
    );
    expect(payload.assumptions.protocolParameters.maxLoanToValue).toBeNull();
    expect(payload.assumptions.protocolParameters.liquidationThreshold).toBeNull();
    expect(payload.assumptions.protocolParameters.collateralFactor).toBe(0.65);
  });

  it('CSV replaces Max LTV/Liquidation Threshold with a single Collateral Factor row for V4', () => {
    const { result, warnings, metadata } = runV4Strategy(V4_PORTFOLIO);
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      V4_PORTFOLIO,
    );
    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Collateral Factor,0.65');
    expect(csv).not.toContain('Max LTV,');
    expect(csv).not.toContain('Liquidation Threshold,');
  });

  it('exports "Collateral Factor,Not available" in CSV / null in JSON when v4CollateralRisk has not synced, never falling back to a V3 number', () => {
    const { result, warnings, metadata } = runV4Strategy(V4_PORTFOLIO);
    const portfolioMissingRisk: ApplicationPortfolio = {
      ...V4_PORTFOLIO,
      v4CollateralRisk: undefined,
    };
    const payload = buildLoopStrategyExportPayload(
      SETTINGS,
      result,
      warnings,
      metadata,
      portfolioMissingRisk,
    );
    expect(payload.assumptions.protocolParameters.collateralFactor).toBeNull();

    const json = buildLoopStrategyExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.collateralFactor).toBeNull();

    const csv = buildLoopStrategyExportCsv(payload);
    expect(csv).toContain('Collateral Factor,Not available');
  });
});

describe('downloadLoopStrategyExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a Blob URL, clicks a temporary anchor, and revokes the URL', () => {
    const { result, warnings, metadata } = runViableStrategy();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });

    downloadLoopStrategyExport(SETTINGS, result, warnings, metadata, PORTFOLIO, 'json');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blobArg] = createObjectURL.mock.calls[0];
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

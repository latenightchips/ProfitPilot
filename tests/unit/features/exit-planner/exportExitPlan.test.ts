import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildExitPlanExportCsv,
  buildExitPlanExportJson,
  buildExitPlanExportPayload,
  downloadExitPlanExport,
  EXIT_EXPORT_SCHEMA_VERSION,
} from '@/features/exit-planner';
import type { ApplicationPortfolio, ExitPlanResult, ServiceMetadata } from '@/services';
import {
  type ExitPlannerTargetInputs,
  type ExitPlannerType,
  useExitPlannerStore,
} from '@/stores/exitPlannerStore';
import type { StrategyWarning } from '@/types/strategy';

/**
 * Exit Plan Export — 06_TASKS.md M7-030. DoD: "Exported plans contain
 * all data required for review." Every payload built below comes from
 * a real `ExitPlanResult` produced by the actual Store actions, never
 * a hand-crafted mock result — matching this whole milestone's own
 * established testing convention.
 */
const PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: {
    maxLoanToValue: 0.75,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

function runFeasiblePlan(): {
  exitType: ExitPlannerType;
  targetInputs: ExitPlannerTargetInputs;
  result: ExitPlanResult;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
} {
  useExitPlannerStore.getState().reset();
  useExitPlannerStore.getState().setExitType('fullExit');
  useExitPlannerStore.getState().runExitCalculation(PORTFOLIO);
  const state = useExitPlannerStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return {
    exitType: 'fullExit',
    targetInputs: state.targetInputs ?? {},
    result: state.currentResult,
    warnings: state.warnings,
    metadata: state.lastMetadata,
  };
}

function runInfeasiblePlan(): {
  exitType: ExitPlannerType;
  targetInputs: ExitPlannerTargetInputs;
  result: ExitPlanResult;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
} {
  useExitPlannerStore.getState().reset();
  useExitPlannerStore.getState().setExitType('partialDebtRepayment');
  useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
  useExitPlannerStore.getState().runExitCalculation(PORTFOLIO);
  const state = useExitPlannerStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return {
    exitType: 'partialDebtRepayment',
    targetInputs: state.targetInputs ?? {},
    result: state.currentResult,
    warnings: state.warnings,
    metadata: state.lastMetadata,
  };
}

describe('buildExitPlanExportPayload', () => {
  it('includes the schema version, exact targets, current portfolio state, expected result, and warnings', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    expect(payload.schemaVersion).toBe(EXIT_EXPORT_SCHEMA_VERSION);
    expect(payload.exitType).toBe('fullExit');
    expect(payload.targetInputs).toEqual(targetInputs);
    expect(payload.currentPortfolioState).toEqual({
      collateralQuantity: 2,
      debtBalance: 20000,
      btcPriceUsd: 50000,
    });
    expect(payload.expectedResult).not.toBeNull();
    expect(payload.expectedResult?.debtRepaid).toBe(result.transaction?.repayment);
    expect(payload.costs).toEqual(result.unavailableCosts);
    expect(payload.warnings).toEqual(warnings);
  });

  it('includes real protocol assumptions and the documented fees & slippage note', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    expect(payload.assumptions.protocolParameters).toEqual(PORTFOLIO.protocol);
    expect(payload.assumptions.feesAndSlippage).toMatch(/Formula ID/);
  });

  it('reports timestamp/versions as null, not fabricated, when metadata is unavailable', () => {
    const { exitType, targetInputs, result, warnings } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      null,
      PORTFOLIO,
    );

    expect(payload.timestamp).toBeNull();
    expect(payload.versions).toBeNull();
  });

  it('reports a null expectedResult and a real infeasibleReason for an infeasible plan', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runInfeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    expect(payload.expectedResult).toBeNull();
    expect(payload.infeasibleReason).not.toBeNull();
    expect(payload.infeasibleReason?.length).toBeGreaterThan(0);
  });
});

describe('buildExitPlanExportJson', () => {
  it('produces valid, pretty-printed JSON that round-trips to the same payload', () => {
    // A partial exit (finite resultingHealthFactor), not the Full Exit
    // fixture — a full exit's own zero remaining debt legitimately
    // produces `Infinity`, which JSON itself cannot represent
    // (`JSON.stringify(Infinity)` is `null`); that is a real property
    // of JSON, not a defect in this builder, so the round-trip fidelity
    // check uses a scenario JSON can actually represent losslessly.
    useExitPlannerStore.getState().reset();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 10000 });
    useExitPlannerStore.getState().runExitCalculation(PORTFOLIO);
    const state = useExitPlannerStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');

    const payload = buildExitPlanExportPayload(
      'partialDebtRepayment',
      state.targetInputs ?? {},
      state.currentResult,
      state.warnings,
      state.lastMetadata,
      PORTFOLIO,
    );

    const json = buildExitPlanExportJson(payload);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual(payload);
  });
});

describe('buildExitPlanExportCsv', () => {
  it('produces a Field,Value table including targets, current state, expected result, and costs', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Field,Value');
    expect(csv).toContain('Exit Type,fullExit');
    expect(csv).toContain('Current Debt Balance,20000');
    expect(csv).toContain(`BTC Sold,${payload.expectedResult?.btcSold}`);
    expect(csv).toContain(`Engine Version,${metadata?.engineVersion}`);
  });

  it('includes a target-specific input row only for the field the user actually supplied', () => {
    useExitPlannerStore.getState().reset();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 5000 });
    useExitPlannerStore.getState().runExitCalculation(PORTFOLIO);
    const state = useExitPlannerStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');

    const payload = buildExitPlanExportPayload(
      'partialDebtRepayment',
      state.targetInputs ?? {},
      state.currentResult,
      state.warnings,
      state.lastMetadata,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('Repayment Amount,5000');
    expect(csv).not.toContain('Target Health Factor');
    expect(csv).not.toContain('Target Retained BTC');
  });

  it('includes each of the other 4 target-specific input rows when their own field is supplied', () => {
    const payload = buildExitPlanExportPayload(
      'targetHealthFactor',
      {
        targetHealthFactor: 8,
        targetRetainedBtc: 1.8,
        targetDebtBalance: 5000,
        scenarioBtcPriceUsd: 25000,
      },
      runFeasiblePlan().result,
      [],
      null,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('Target Health Factor,8');
    expect(csv).toContain('Target Retained BTC,1.8');
    expect(csv).toContain('Target Debt Balance,5000');
    expect(csv).toContain('Target BTC Price,25000');
  });

  it('shows "Not available" with the real infeasible reason for an infeasible plan export', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runInfeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('Expected Result,Not available —');
    expect(csv).not.toContain('BTC Sold,');
  });

  it('itemizes each unavailable cost as its own row', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('Cost — swapFees');
    expect(csv).toContain('Cost — slippage');
    expect(csv).toContain('Cost — gasEstimate');
  });

  it('comma-escapes a warning cause containing a comma', () => {
    const { exitType, targetInputs, result, metadata } = runFeasiblePlan();
    const warnings: StrategyWarning[] = [
      {
        category: 'infeasibleStrategy',
        severity: 'error',
        cause: 'A cause, with a comma',
        suggestedResponse: 'Respond.',
      },
    ];
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      metadata,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('"error: A cause, with a comma"');
  });

  it('shows "Not captured" instead of fabricating a value when metadata is unavailable', () => {
    const { exitType, targetInputs, result, warnings } = runFeasiblePlan();
    const payload = buildExitPlanExportPayload(
      exitType,
      targetInputs,
      result,
      warnings,
      null,
      PORTFOLIO,
    );

    const csv = buildExitPlanExportCsv(payload);
    expect(csv).toContain('Timestamp,Not captured');
    expect(csv).toContain('Engine Version,Not captured');
    expect(csv).toContain('Formula Version,Not captured');
  });
});

describe('downloadExitPlanExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a Blob URL, clicks a temporary anchor, and revokes the URL', () => {
    const { exitType, targetInputs, result, warnings, metadata } = runFeasiblePlan();
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

    downloadExitPlanExport(exitType, targetInputs, result, warnings, metadata, PORTFOLIO, 'json');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blobArg] = createObjectURL.mock.calls[0];
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

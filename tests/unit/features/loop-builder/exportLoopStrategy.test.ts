import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildLoopStrategyExportCsv,
  buildLoopStrategyExportJson,
  buildLoopStrategyExportPayload,
  downloadLoopStrategyExport,
  LOOP_EXPORT_SCHEMA_VERSION,
} from '@/features/loop-builder';
import type { ApplicationPortfolio, LoopStrategyPreview, ServiceMetadata } from '@/services';
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

    expect(payload.assumptions.protocolParameters).toEqual(PORTFOLIO.protocol);
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

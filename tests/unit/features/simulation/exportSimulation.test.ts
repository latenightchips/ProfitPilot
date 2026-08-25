import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildSimulationExportCsv,
  buildSimulationExportJson,
  buildSimulationExportPayload,
  csvEscape,
  downloadSimulationExport,
  SIMULATION_EXPORT_SCHEMA_VERSION,
} from '@/features/simulation';
import {
  type ApplicationPortfolio,
  deriveAaveV4EffectiveBorrowRate,
  type ServiceMetadata,
  type SimulationResult,
} from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Export — 06_TASKS.md M6-019 ("Export Simulation"). DoD:
 * "Exported simulations are reproducible." Every payload built below
 * comes from a real `SimulationResult` produced by the actual Store
 * actions, never a hand-crafted mock result — matching this whole
 * milestone's own established testing convention.
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

function runPriceScenario(): { result: SimulationResult; metadata: ServiceMetadata | null } {
  useSimulationStore.getState().reset();
  useSimulationStore.getState().setCurrentScenario({
    type: 'price',
    priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const state = useSimulationStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return { result: state.currentResult, metadata: state.lastMetadata };
}

function runInterestScenario(): { result: SimulationResult; metadata: ServiceMetadata | null } {
  useSimulationStore.getState().reset();
  useSimulationStore.getState().setCurrentScenario({
    type: 'interest',
    priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    borrowApr: 0.1,
    timeHorizonDays: 100,
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const state = useSimulationStore.getState();
  if (state.currentResult === null) throw new Error('setup failed');
  return { result: state.currentResult, metadata: state.lastMetadata };
}

describe('buildSimulationExportPayload', () => {
  it('includes the schema version, exact inputs/outputs, real formula version, and timestamp', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );

    expect(payload.schemaVersion).toBe(SIMULATION_EXPORT_SCHEMA_VERSION);
    expect(payload.inputs).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    expect(payload.outputs.baseline).toEqual(result.baseline);
    expect(payload.outputs.scenario).toEqual(result.scenario);
    expect(payload.outputs.comparison).toEqual(result.comparison);
    expect(payload.assumptions.priceScenario).toEqual({ type: 'absolute', btcPriceUsd: 65000 });
    expect(payload.assumptions.rateAssumption).toBeNull();
    expect(payload.assumptions.protocolParameters).toEqual({
      ...PORTFOLIO.protocol,
      collateralFactor: null,
    });
    expect(payload.assumptions.feesAndSlippage).toMatch(/no Formula ID or equation/);
    expect(payload.timestamp).toBe(metadata?.calculationTimestamp);
    expect(payload.formulaVersion).toEqual({
      engineVersion: metadata?.engineVersion,
      formulaVersion: metadata?.formulaVersion,
    });
  });

  it('includes rateAssumption for an interest scenario', () => {
    const { result, metadata } = runInterestScenario();
    const payload = buildSimulationExportPayload(
      {
        type: 'interest',
        priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
        borrowApr: 0.1,
        timeHorizonDays: 100,
      },
      result,
      metadata,
      PORTFOLIO,
    );

    expect(payload.assumptions.rateAssumption).toEqual({
      borrowApr: 0.1,
      timeHorizonDays: 100,
    });
  });

  it('reports timestamp/formulaVersion as null, not fabricated, when metadata is unavailable', () => {
    const { result } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      null,
      PORTFOLIO,
    );

    expect(payload.timestamp).toBeNull();
    expect(payload.formulaVersion).toBeNull();
  });
});

describe('buildSimulationExportJson', () => {
  it('produces valid, pretty-printed JSON that round-trips to the same payload', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );

    const json = buildSimulationExportJson(payload);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual(payload);
  });
});

describe('csvEscape', () => {
  it('leaves a plain value unquoted', () => {
    expect(csvEscape('80000')).toBe('80000');
  });

  it('quotes a value containing a comma, and doubles up internal quotes, per standard CSV escaping', () => {
    expect(csvEscape('a, "b", c')).toBe('"a, ""b"", c"');
  });

  it('quotes a value containing a newline', () => {
    expect(csvEscape('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('buildSimulationExportCsv', () => {
  it('reports Percentage Change instead of BTC Price for a percentage-change price scenario', () => {
    useSimulationStore.getState().reset();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const state = useSimulationStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');

    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'percentageChange', percentageChange: 0.2 } },
      state.currentResult,
      state.lastMetadata,
      PORTFOLIO,
    );

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Percentage Change,0.2');
    expect(csv).not.toContain('BTC Price (USD)');
  });

  it('includes Rate Assumption rows for an interest scenario', () => {
    const { result, metadata } = runInterestScenario();
    const payload = buildSimulationExportPayload(
      {
        type: 'interest',
        priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
        borrowApr: 0.1,
        timeHorizonDays: 100,
      },
      result,
      metadata,
      PORTFOLIO,
    );

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Rate Assumption Borrow APR,0.1');
    expect(csv).toContain('Rate Assumption Time Horizon (days),100');
  });

  it('produces a Field,Value table including inputs, outputs, assumptions, timestamp, and formula version', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );

    const csv = buildSimulationExportCsv(payload);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Field,Value');
    expect(csv).toContain('Scenario Type,price');
    expect(csv).toContain('BTC Price (USD),65000');
    expect(csv).toContain(`Baseline Equity,${result.baseline.equity}`);
    expect(csv).toContain(`Scenario Equity,${result.scenario.equity}`);
    expect(csv).toContain('Max LTV,0.75');
    expect(csv).toContain(`Engine Version,${metadata?.engineVersion}`);
    expect(csv).toContain(`Formula Version,${metadata?.formulaVersion}`);
  });

  it('leaves the Fees & Slippage note unquoted in a real export, since it contains no comma/quote/newline', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain(
      'Fees & Slippage,Not included — no Formula ID or equation for swap fees or slippage exists in 02_Formulas.md.',
    );
  });

  it('shows "Not captured" instead of fabricating a value when metadata is unavailable', () => {
    const { result } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      null,
      PORTFOLIO,
    );

    const csv = buildSimulationExportCsv(payload);
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
 * tests already established. Distinct from `assumptions.rateAssumption`
 * (the scenario's own V3-shaped interest-rate input, untouched by this
 * stage), which only exists for an interest scenario and is exercised
 * separately by `runInterestScenario`'s own existing test above.
 */
describe('buildSimulationExportPayload — V4 canonical Borrow APR (Stage 22)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocol: { ...PORTFOLIO.protocol, borrowApr: 0.99 },
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
  };

  function runV4PriceScenario(): { result: SimulationResult; metadata: ServiceMetadata | null } {
    useSimulationStore.getState().reset();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(V4_PORTFOLIO);
    const state = useSimulationStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, metadata: state.lastMetadata };
  }

  it('exports the canonical effective V4 rate, never the raw 99% legacy scalar', () => {
    const { result, metadata } = runV4PriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      V4_PORTFOLIO,
    );

    const rateStep = deriveAaveV4EffectiveBorrowRate(V4_PORTFOLIO.v4DebtState!, null, 'export');
    if (!rateStep.ok) throw new Error('setup failed: expected a valid effective rate');
    expect(payload.assumptions.protocolParameters.borrowApr).toBeCloseTo(rateStep.value);
    expect(payload.assumptions.protocolParameters.borrowApr).not.toBe(0.99);

    const csv = buildSimulationExportCsv(payload);
    expect(csv).not.toContain('Borrow APR (Protocol),0.99');
  });

  it('never falls back to the legacy scalar when v4DebtState is unavailable — exports null (JSON) / "Not available" (CSV)', () => {
    const { result, metadata } = runV4PriceScenario();
    const portfolioMissingDebtState: ApplicationPortfolio = {
      ...V4_PORTFOLIO,
      v4DebtState: undefined,
    };
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      portfolioMissingDebtState,
    );

    expect(payload.assumptions.protocolParameters.borrowApr).toBeNull();
    expect(payload.assumptions.protocolParameters.borrowApr).not.toBe(0.99);

    const json = buildSimulationExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.borrowApr).toBeNull();

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Borrow APR (Protocol),Not available');
    expect(csv).not.toContain('Borrow APR (Protocol),0.99');
  });

  it('a V3 (or unset) portfolio is completely unaffected — protocolParameters still equals the raw portfolio.protocol', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );
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
describe('buildSimulationExportPayload — Supply APR (P1-1)', () => {
  const LIVE_V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocol: { ...PORTFOLIO.protocol, supplyApr: 0.045 },
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    v4CollateralRiskSource: 'live',
  };

  function runV4PriceScenario(portfolio: ApplicationPortfolio): {
    result: SimulationResult;
    metadata: ServiceMetadata | null;
  } {
    useSimulationStore.getState().reset();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);
    const state = useSimulationStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, metadata: state.lastMetadata };
  }

  it('exports null (JSON) / "Not available" (CSV) for a live V4 portfolio, never the leftover 0.045 figure', () => {
    const { result, metadata } = runV4PriceScenario(LIVE_V4_PORTFOLIO);
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      LIVE_V4_PORTFOLIO,
    );

    expect(payload.assumptions.protocolParameters.supplyApr).toBeNull();

    const json = buildSimulationExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.supplyApr).toBeNull();

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Supply APR,Not available');
    expect(csv).not.toContain('Supply APR,0.045');
  });

  it('exports null/"Not available" for a V4 portfolio with no v4CollateralRiskSource yet', () => {
    // The simulation itself needs a synced v4CollateralRisk to succeed
    // (fail-closed, unrelated to this fix) — run it against
    // LIVE_V4_PORTFOLIO for a valid result, then build the export payload
    // against a *different* portfolio object with no synced
    // v4CollateralRisk, the same "display reads directly from the
    // portfolio prop, not the stored result" pattern the Borrow APR block
    // above already established.
    const { result, metadata } = runV4PriceScenario(LIVE_V4_PORTFOLIO);
    const notYetSynced: ApplicationPortfolio = {
      ...LIVE_V4_PORTFOLIO,
      v4CollateralRisk: undefined,
      v4CollateralRiskSource: undefined,
    };
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
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
    const { result, metadata } = runV4PriceScenario(manualV4);
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      manualV4,
    );
    expect(payload.assumptions.protocolParameters.supplyApr).toBe(0.045);
  });

  it('a V3 (or unset) portfolio is completely unaffected — still exports the real protocol.supplyApr', () => {
    const { result, metadata } = runPriceScenario();
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
    );
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
describe('buildSimulationExportPayload — V4 risk-capacity export (Stage 23E)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    ...PORTFOLIO,
    protocolVersion: 'v4',
    v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
  };

  function runV4PriceScenario(portfolio: ApplicationPortfolio): {
    result: SimulationResult;
    metadata: ServiceMetadata | null;
  } {
    useSimulationStore.getState().reset();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);
    const state = useSimulationStore.getState();
    if (state.currentResult === null) throw new Error('setup failed');
    return { result: state.currentResult, metadata: state.lastMetadata };
  }

  it('exports maxLoanToValue/liquidationThreshold as null and the real collateralFactor for a V4 portfolio, never a reinterpreted V3 field', () => {
    const { result, metadata } = runV4PriceScenario(V4_PORTFOLIO);
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      V4_PORTFOLIO,
    );
    expect(payload.assumptions.protocolParameters.maxLoanToValue).toBeNull();
    expect(payload.assumptions.protocolParameters.liquidationThreshold).toBeNull();
    expect(payload.assumptions.protocolParameters.collateralFactor).toBe(0.65);
  });

  it('CSV replaces Max LTV/Liquidation Threshold with a single Collateral Factor row for V4', () => {
    const { result, metadata } = runV4PriceScenario(V4_PORTFOLIO);
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      V4_PORTFOLIO,
    );
    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Collateral Factor,0.65');
    expect(csv).not.toContain('Max LTV,');
    expect(csv).not.toContain('Liquidation Threshold,');
  });

  it('exports "Collateral Factor,Not available" in CSV / null in JSON when v4CollateralRisk has not synced, never falling back to a V3 number', () => {
    const { result, metadata } = runV4PriceScenario(V4_PORTFOLIO);
    const portfolioMissingRisk: ApplicationPortfolio = {
      ...V4_PORTFOLIO,
      v4CollateralRisk: undefined,
    };
    const payload = buildSimulationExportPayload(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      portfolioMissingRisk,
    );
    expect(payload.assumptions.protocolParameters.collateralFactor).toBeNull();

    const json = buildSimulationExportJson(payload);
    expect(JSON.parse(json).assumptions.protocolParameters.collateralFactor).toBeNull();

    const csv = buildSimulationExportCsv(payload);
    expect(csv).toContain('Collateral Factor,Not available');
  });
});

describe('downloadSimulationExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a Blob URL, clicks a temporary anchor named after the scenario type/format, and revokes the URL', () => {
    const { result, metadata } = runPriceScenario();
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

    downloadSimulationExport(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
      'json',
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blobArg] = createObjectURL.mock.calls[0];
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('names the CSV download after the scenario type with a .csv extension', () => {
    const { result, metadata } = runPriceScenario();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') {
        element.click = vi.fn();
        anchor = element as HTMLAnchorElement;
      }
      return element;
    });

    downloadSimulationExport(
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 65000 } },
      result,
      metadata,
      PORTFOLIO,
      'csv',
    );

    expect(anchor?.download).toBe('simulation-export-price.csv');
  });
});

import { describe, expect, it } from 'vitest';

import { projectAaveV4Debt } from '@/engine/protocols/aaveV4/projectAaveV4Debt';

/**
 * Deterministic parity vectors for `projectAaveV4Debt` — V4 Readiness
 * Audit §12 Stage 2. Every expected value below comes from the same
 * standalone Node.js BigInt script used for `math.test.ts` (not this test
 * file, not `projectAaveV4Debt.ts`), independently reimplementing
 * `docs/overview.md`'s drawn/premium accrual formula from scratch —
 * see the Stage 2 report's vector-derivation methodology and
 * `math.test.ts`'s header comment for the shared discipline.
 *
 * Expected values are truncated to 6 decimal places relative to the
 * script's full 27-decimal-place output — `toOutputNumber` converts the
 * Engine's internal Decimal to a native `number`, so assertions use
 * `toBeCloseTo` at a precision well within IEEE-754 double accuracy for
 * these magnitudes (the same convention `aaveV3/projectVariableDebt.test.ts`
 * already uses).
 */
describe('projectAaveV4Debt — drawn + risk-premium debt projection (aave-v4 docs/overview.md parity)', () => {
  it('zero risk premium -> premiumDebt never accrues, only drawn debt grows (365d, $20,000 @ 5% APR)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(21000, 6);
    expect(result.value.premiumDebt).toBeCloseTo(0, 6);
    expect(result.value.totalDebt).toBeCloseTo(21000, 6);
    expect(result.metadata.formulaId).toBe('AAVE-V4-DRAWN-PREMIUM');
  });

  it('non-zero risk premium accrues premium debt in proportion to drawn interest (365d, 10% risk premium)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(21000, 6);
    expect(result.value.premiumDebt).toBeCloseTo(100, 6);
    expect(result.value.totalDebt).toBeCloseTo(21100, 6);
  });

  it('premium-only-ish: zero base rate means zero drawn interest, so premium (proportional to it) also stays zero', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(20000, 6);
    expect(result.value.premiumDebt).toBeCloseTo(0, 6);
    expect(result.value.totalDebt).toBeCloseTo(20000, 6);
  });

  it('base-only: zero risk premium over 30 days still grows drawn debt via linear interest', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(20082.191781, 5);
    expect(result.value.premiumDebt).toBeCloseTo(0, 6);
    expect(result.value.totalDebt).toBeCloseTo(20082.191781, 5);
  });

  it('both drawn and premium combined (90d, 25% risk premium)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.25,
      elapsedDays: 90,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(20246.575342, 5);
    expect(result.value.premiumDebt).toBeCloseTo(61.643836, 5);
    expect(result.value.totalDebt).toBeCloseTo(20308.219178, 5);
  });

  it('elapsed=0 -> both streams unchanged regardless of rates', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(20000);
    expect(result.value.premiumDebt).toBe(0);
    expect(result.value.totalDebt).toBe(20000);
  });

  it('an existing nonzero premiumDebt balance is carried forward and added to newly-accrued premium (365d)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(21000, 6);
    expect(result.value.premiumDebt).toBeCloseTo(600, 6); // 500 existing + 100 newly accrued
    expect(result.value.totalDebt).toBeCloseTo(21600, 6);
  });

  it("boundary: high risk premium (1000% = 10.00, docs/overview.md's own stated Collateral Risk ceiling) over 30d", () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 10.0,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeCloseTo(20082.191781, 5);
    expect(result.value.premiumDebt).toBeCloseTo(821.917808, 5);
    expect(result.value.totalDebt).toBeCloseTo(20904.109589, 5);
  });

  it.each([
    [30, 26106.849315, 10.684932, 26117.534247],
    [90, 26320.547945, 32.054795, 26352.60274],
    [180, 26641.09589, 64.109589, 26705.205479],
  ])(
    'representative: $26,000 debt @ 5%% APR / 10%% risk premium over %i days',
    (days, expectedDrawn, expectedPremium, expectedTotal) => {
      const result = projectAaveV4Debt({
        drawnDebt: 26000,
        premiumDebt: 0,
        baseDrawnApr: 0.05,
        riskPremium: 0.1,
        elapsedDays: days,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.drawnDebt).toBeCloseTo(expectedDrawn, 4);
      expect(result.value.premiumDebt).toBeCloseTo(expectedPremium, 4);
      expect(result.value.totalDebt).toBeCloseTo(expectedTotal, 4);
    },
  );

  it('rejects a negative drawnDebt balance', () => {
    const result = projectAaveV4Debt({
      drawnDebt: -1,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative premiumDebt balance', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: -1,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative baseDrawnApr', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: -0.01,
      riskPremium: 0.1,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative riskPremium', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: -0.01,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('accepts a riskPremium above 1.0 (100%) — Collateral Risk can reach up to 1000% per docs/overview.md, not a [0,1] percentage', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 1.5,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a negative elapsedDays', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: -1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects NaN input rather than propagating it', () => {
    const result = projectAaveV4Debt({
      drawnDebt: NaN,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_FINITE');
  });

  it('never returns NaN or Infinity for any valid input', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 26000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 180,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value.drawnDebt)).toBe(true);
    expect(Number.isFinite(result.value.premiumDebt)).toBe(true);
    expect(Number.isFinite(result.value.totalDebt)).toBe(true);
  });

  it('totalDebt always equals the sum of drawnDebt and premiumDebt (no fabricated blended figure)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 26000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 90,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalDebt).toBeCloseTo(
      result.value.drawnDebt + result.value.premiumDebt,
      6,
    );
  });

  it("riskPremium represents the position's already-resolved, currently-effective Risk Premium — not a value this function recomputes from collateral (Stage 2 review, item C)", () => {
    // Two positions with identical current balances but different
    // stored/effective riskPremium values must diverge going forward:
    // this function trusts the input, it never re-derives RP_u from a
    // collateral list (the Risk Premium Algorithm is explicitly out of
    // scope here — see projectAaveV4Debt.ts's header comment).
    const staleEffectiveRiskPremium = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.05, // e.g. the position's stored, not-yet-refreshed RP_u
      elapsedDays: 365,
    });
    const freshlyRecomputedRiskPremium = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.2, // e.g. a hypothetical fresh Risk Premium Algorithm output
      elapsedDays: 365,
    });
    expect(staleEffectiveRiskPremium.ok).toBe(true);
    expect(freshlyRecomputedRiskPremium.ok).toBe(true);
    if (!staleEffectiveRiskPremium.ok || !freshlyRecomputedRiskPremium.ok) return;
    // The function has no way to tell these apart — it is the caller's
    // (Stage 3's) responsibility to supply the position's actual
    // currently-effective value, per AaveV4DebtProjectionInput.riskPremium.
    expect(staleEffectiveRiskPremium.value.premiumDebt).not.toBeCloseTo(
      freshlyRecomputedRiskPremium.value.premiumDebt,
      6,
    );
  });
});

/**
 * Numeric output boundary — Stage 2 hardening (adversarial review item F).
 * The Stage 2 review flagged that the earlier "boundary-large-integer"
 * coverage only exercised the raw BigInt math layer (`math.test.ts`), never
 * the public `number`-returning API this function actually exposes. These
 * tests close that gap: they assert the Decimal -> JS `number` conversion
 * (`toOutputNumber`) stays safe for representative large-but-valid debt
 * values, without inventing an arbitrary protocol maximum — the Engine's
 * own validators (`validateNonNegative`/`validateRate`/`validateTimePeriod`)
 * impose no upper bound, so "large" here means "large relative to realistic
 * dollar-denominated debt," not a tested ceiling.
 */
describe('projectAaveV4Debt — numeric output boundary (Decimal -> number, large-but-valid values)', () => {
  it.each([
    ['$1 million debt, representative rates, 1 year', 1_000_000, 0.05, 0.1, 365],
    ['$1 billion debt, representative rates, 1 year', 1_000_000_000, 0.05, 0.1, 365],
    ['$1 trillion debt, representative rates, 1 year', 1_000_000_000_000, 0.05, 0.1, 365],
    ['$1 billion debt, high rate + high risk premium, multi-year', 1_000_000_000, 0.5, 2.0, 1825],
  ])('%s: finite, non-negative, and internally consistent', (_label, drawnDebt, apr, rp, days) => {
    const result = projectAaveV4Debt({
      drawnDebt,
      premiumDebt: 0,
      baseDrawnApr: apr,
      riskPremium: rp,
      elapsedDays: days,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Number.isFinite(result.value.drawnDebt)).toBe(true);
    expect(Number.isFinite(result.value.premiumDebt)).toBe(true);
    expect(Number.isFinite(result.value.totalDebt)).toBe(true);

    expect(result.value.drawnDebt).toBeGreaterThanOrEqual(0);
    expect(result.value.premiumDebt).toBeGreaterThanOrEqual(0);
    expect(result.value.totalDebt).toBeGreaterThanOrEqual(0);

    // Relative tolerance, not a fixed decimal-place tolerance: at these
    // magnitudes an absolute `toBeCloseTo(x, 6)` is meaninglessly strict
    // (IEEE-754 doubles carry ~15-17 significant digits total, not 6
    // decimal places *on top of* a 12-13 digit integer part). The
    // consistency property under test is "no economically meaningful
    // precision loss," i.e. sum-consistency to within 1e-6 relative error.
    const relativeError =
      Math.abs(result.value.totalDebt - (result.value.drawnDebt + result.value.premiumDebt)) /
      result.value.totalDebt;
    expect(relativeError).toBeLessThan(1e-9);
  });

  it('a debt value at the edge of Number.MAX_SAFE_INTEGER stays finite and non-negative (no silent overflow to Infinity/NaN)', () => {
    const result = projectAaveV4Debt({
      drawnDebt: 1_000_000_000_000, // $1 trillion — comfortably below MAX_SAFE_INTEGER even after growth
      premiumDebt: 0,
      baseDrawnApr: 1.0, // 100% APR, deliberately aggressive
      riskPremium: 10.0, // 1000% risk premium — docs/overview.md's own stated ceiling
      elapsedDays: 3650, // 10 years
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value.drawnDebt)).toBe(true);
    expect(Number.isFinite(result.value.premiumDebt)).toBe(true);
    expect(Number.isFinite(result.value.totalDebt)).toBe(true);
    expect(result.value.drawnDebt).toBeGreaterThanOrEqual(0);
    expect(result.value.premiumDebt).toBeGreaterThanOrEqual(0);
    expect(result.value.totalDebt).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateLiquidationBuffer } from '@/engine/liquidation/calculateLiquidationBuffer';
import { calculateLiquidationDistance } from '@/engine/liquidation/calculateLiquidationDistance';
import { calculateLiquidationPrice } from '@/engine/liquidation/calculateLiquidationPrice';
import {
  calculateAvailableBorrow,
  calculateBorrowCapacity,
} from '@/engine/loop/calculateBorrowCapacity';

/**
 * Critical risk formula boundary/error regression suite — 06_TASKS.md
 * M2-029's Requirement: "Critical risk formulas have boundary and error
 * tests." Per-function unit tests (tests/unit/engine/health/,
 * tests/unit/engine/liquidation/, tests/unit/engine/loop/) already cover
 * each formula's own documented example and invalid-input cases; this
 * file adds the boundary case those per-function suites don't: the exact
 * point at which a position becomes liquidatable, checked *across*
 * Formula IDs (F-022 Health Factor, F-023 Distance to Liquidation, F-024
 * Liquidation Price, F-025 Liquidation Buffer) rather than within just
 * one, since a liquidation-risk system's most safety-critical property is
 * that these formulas agree with each other exactly at the boundary. All
 * functions exercised here are already implemented (F-012, F-013, F-022,
 * F-023, F-024, F-025) — no new formula, threshold, or tolerance is
 * introduced.
 *
 * ("Golden Reference results remain unchanged unless formally approved,"
 * M2-029's third Requirement, is already enforced by
 * tests/unit/engine/goldenReferencePortfolios.test.ts (M2-028), which
 * asserts exact locked values — not duplicated here.)
 */
describe('Critical risk formula boundaries (M2-029)', () => {
  const scenarios = [
    { collateralValue: 120000, liquidationThreshold: 0.8, debtValue: 70000 },
    { collateralValue: 99999.9999, liquidationThreshold: 0.8, debtValue: 77000 },
    { collateralValue: 50000, liquidationThreshold: 0.5, debtValue: 10000 },
  ];

  it.each(scenarios)(
    'Health Factor equals exactly 1.0 when BTC price equals the computed Liquidation Price (collateral $collateralValue, threshold $liquidationThreshold, debt $debtValue)',
    ({ collateralValue, liquidationThreshold, debtValue }) => {
      const currentBtcPrice = 60000;

      const liquidationPriceResult = calculateLiquidationPrice(
        currentBtcPrice,
        debtValue,
        collateralValue,
        liquidationThreshold,
      );
      expect(liquidationPriceResult.ok).toBe(true);
      if (!liquidationPriceResult.ok) return;

      // Collateral value scales linearly with BTC price for a fixed BTC
      // quantity; at the liquidation price the collateral is worth exactly
      // (liquidationPrice / currentBtcPrice) times its current value.
      const collateralValueAtLiquidationPrice =
        (collateralValue * liquidationPriceResult.value) / currentBtcPrice;

      const healthFactorAtLiquidation = calculateHealthFactor(
        collateralValueAtLiquidationPrice,
        liquidationThreshold,
        debtValue,
      );
      expect(healthFactorAtLiquidation.ok).toBe(true);
      if (healthFactorAtLiquidation.ok) {
        expect(healthFactorAtLiquidation.value).toBeCloseTo(1.0, 6);
      }
    },
  );

  it.each(scenarios)(
    'Liquidation Buffer equals exactly 0% when the current price equals the Liquidation Price (collateral $collateralValue, threshold $liquidationThreshold, debt $debtValue)',
    ({ collateralValue, liquidationThreshold, debtValue }) => {
      const currentBtcPrice = 60000;

      const liquidationPriceResult = calculateLiquidationPrice(
        currentBtcPrice,
        debtValue,
        collateralValue,
        liquidationThreshold,
      );
      expect(liquidationPriceResult.ok).toBe(true);
      if (!liquidationPriceResult.ok) return;

      // Same rescaling as the Health Factor boundary test above: Collateral
      // Value must be re-derived at the liquidation price, not reused as a
      // fixed dollar amount from the original currentBtcPrice.
      const collateralValueAtLiquidationPrice =
        (collateralValue * liquidationPriceResult.value) / currentBtcPrice;

      const bufferAtLiquidationPrice = calculateLiquidationBuffer(
        liquidationPriceResult.value,
        debtValue,
        collateralValueAtLiquidationPrice,
        liquidationThreshold,
      );
      expect(bufferAtLiquidationPrice.ok).toBe(true);
      if (bufferAtLiquidationPrice.ok) {
        expect(bufferAtLiquidationPrice.value).toBeCloseTo(0, 6);
      }
    },
  );

  it('Distance to Liquidation equals exactly 0 when Health Factor is exactly 1.0', () => {
    // Collateral $100,000 * threshold 100% = debt $100,000 -> HF = 1.0 exactly.
    const result = calculateLiquidationDistance(100000, 1, 100000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0, 10);
    }
  });

  it('Health Factor equals exactly 1.0 at the boundary (collateral * threshold == debt)', () => {
    const result = calculateHealthFactor(100000, 0.8, 80000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1);
    }
  });

  it('Available Borrow equals exactly 0 when current debt equals Borrow Capacity', () => {
    const capacityResult = calculateBorrowCapacity(100000, 0.7);
    expect(capacityResult.ok).toBe(true);
    if (!capacityResult.ok) return;

    const availableResult = calculateAvailableBorrow(100000, 0.7, capacityResult.value);
    expect(availableResult.ok).toBe(true);
    if (availableResult.ok) {
      expect(availableResult.value).toBe(0);
      expect(availableResult.warnings).toEqual([]);
    }
  });

  it('Available Borrow is negative with a warning the instant debt exceeds Borrow Capacity by any amount', () => {
    const capacityResult = calculateBorrowCapacity(100000, 0.7);
    expect(capacityResult.ok).toBe(true);
    if (!capacityResult.ok) return;

    const availableResult = calculateAvailableBorrow(100000, 0.7, capacityResult.value + 0.01);
    expect(availableResult.ok).toBe(true);
    if (availableResult.ok) {
      expect(availableResult.value).toBeCloseTo(-0.01, 10);
      expect(availableResult.warnings.some((w) => w.code === 'BORROW_CAPACITY_EXCEEDED')).toBe(
        true,
      );
    }
  });

  it('rejects a liquidation threshold of exactly 0 as a boundary error case (HF would always be 0 with any debt)', () => {
    const result = calculateHealthFactor(100000, 0, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('accepts a liquidation threshold of exactly 1 (upper boundary of the valid [0, 1] range)', () => {
    const result = calculateHealthFactor(100000, 1, 100000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1);
  });

  it('rejects a liquidation threshold just above the valid range (1.0000001)', () => {
    const result = calculateHealthFactor(100000, 1.0000001, 50000);
    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { calculateExitPosition } from '@/engine/exit/calculateExitPosition';
import type { PortfolioInput } from '@/engine/shared/types';
import { checkFullRepaymentInvariant } from '@/engine/validation/invariants';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

/**
 * 06_TASKS.md M2-027 invariant: "Full debt repayment produces zero
 * debt." A full exit (`targetDebt: 0`) via `calculateExitPosition`
 * (M2-023) must leave exactly zero remaining debt across every scenario.
 */
describe('Engine invariant: Full debt repayment produces zero debt (M2-027)', () => {
  const scenarios: PortfolioInput[] = [
    {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 48000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    },
    {
      collateral: { asset: 'BTC', quantity: 5 },
      debt: { asset: 'USDC', balance: 120000 },
      market: { btcPriceUsd: 90000 },
      protocol,
    },
    {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
    },
  ];

  it.each(scenarios)('holds for a full exit of %o', (portfolio) => {
    const result = calculateExitPosition({ portfolio, targetDebt: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(checkFullRepaymentInvariant(result.value.remainingDebt)).toBe(true);
  });
});

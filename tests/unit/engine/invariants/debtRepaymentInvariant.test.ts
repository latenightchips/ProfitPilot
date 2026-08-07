import { describe, expect, it } from 'vitest';

import { calculateRequiredDebtRepayment } from '@/engine/exit/calculateRequiredDebtRepayment';
import { checkDebtRepaymentInvariant } from '@/engine/validation/invariants';

/**
 * 06_TASKS.md M9-009 invariant: "Debt repayment reduces debt by the
 * expected amount." F-041's own equation, checked across several partial
 * repayment scenarios rather than trusted from a single unit test — the
 * existing invariants/fullRepaymentInvariant.test.ts (M2-027) covers only
 * the full-repayment (`targetDebt: 0`) case; this covers partial
 * repayment, the case M9-009's own example text names.
 */
describe('Engine invariant: Debt repayment reduces debt by the expected amount (M9-009)', () => {
  const scenarios: { currentDebt: number; targetDebt: number }[] = [
    { currentDebt: 60000, targetDebt: 30000 },
    { currentDebt: 100000, targetDebt: 0 },
    { currentDebt: 45000, targetDebt: 44999.99 },
    { currentDebt: 0, targetDebt: 0 },
  ];

  it.each(scenarios)('holds for repaying from $currentDebt to $targetDebt', (scenario) => {
    const { currentDebt, targetDebt } = scenario;

    const repaymentResult = calculateRequiredDebtRepayment(currentDebt, targetDebt);
    expect(repaymentResult.ok).toBe(true);
    if (!repaymentResult.ok) return;

    expect(checkDebtRepaymentInvariant(currentDebt, targetDebt, repaymentResult.value)).toBe(true);
  });
});

import { type ApplicationPortfolio, deriveAaveV4EffectiveBorrowRate } from '@/services';

/**
 * V4 Readiness Audit §12 Stage 17 (Part 1). Extracted so
 * `LoopStrategyControls.tsx`'s default-seeded "Borrow interest rate
 * assumption" field and `LoopBuilderPageClient.tsx`'s
 * `borrowRateAssumption` prop to `LoopPresets.tsx` share one derivation,
 * rather than each reimplementing the V3/V4 branch inline.
 *
 * **V3 (or unset `protocolVersion`) is unaffected** — returns the same
 * `portfolio.protocol.borrowApr` scalar both call sites already used.
 *
 * **V4 no longer uses `protocol.borrowApr` at all.** That field is a
 * legacy V3-shaped scalar with no defined relationship to a V4 position's
 * real two-parameter rate (`baseDrawnApr` + `riskPremium`) — see
 * `services/portfolio/mapping.ts`'s `deriveAaveV4EffectiveBorrowRate` for
 * the full reasoning, already applied to the Dashboard, Portfolio Detail,
 * `services/loop/strategy.ts`, and `services/recommendation/recommendations.ts`
 * at Stage 15. This closes the one remaining consumer the Stage 16.5
 * closure audit found still reading it directly for a V4 portfolio.
 *
 * Returns `null` — never a fabricated or stale V3 number — when a V4
 * portfolio has no synced `v4DebtState` yet, or when the derivation
 * itself fails; callers decide their own display/seed fallback for that
 * case (fail-closed data, not a fail-closed UI).
 */
export function resolveBorrowRateAssumption(portfolio: ApplicationPortfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') {
    return portfolio.protocol.borrowApr;
  }
  if (portfolio.v4DebtState === undefined) {
    return null;
  }
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, null, 'manual');
  return rateStep.ok ? rateStep.value : null;
}

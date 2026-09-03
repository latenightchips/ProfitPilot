/**
 * Builds a `PersistedPortfolioHistoryEntry` from a portfolio's current
 * state and its already-computed `PortfolioSummary` — V1.1 Batch 2
 * ("Portfolio History & Risk Timeline").
 *
 * **No new calculation is invented here.** Every field is either read
 * directly off `ApplicationPortfolio`/`PortfolioSummary`, or resolved via
 * an existing, already-tested Service function
 * (`resolveSupplyAprDisplay`, `deriveAaveV4EffectiveBorrowRate`) — the
 * same functions the rest of the application's own UI already calls for
 * the identical values, so a history entry's numbers always agree with
 * what was actually shown to the user at the time, never a
 * independently-re-derived approximation.
 *
 * **V3/V4 isolation, structurally.** Every V4-specific value
 * (`v4DebtState`-derived quantity, effective borrow rate) is only ever
 * read inside the `protocolVersion === 'v4'` branch; a V3 portfolio's
 * entry is built entirely from `protocol`/`debt.balance`, never touching
 * a V4 field. `protocolVersion` itself is persisted on every entry
 * specifically so a later reader (the History UI, a future migration)
 * never has to guess or re-infer which semantics produced a given row.
 */
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import type { ApplicationPortfolio, PortfolioSummary } from '@/services/portfolio';
import { deriveAaveV4EffectiveBorrowRate, resolveSupplyAprDisplay } from '@/services/portfolio';

/**
 * V4 Mixed-Provenance UX batch — the V4 branch previously reported `'live'`
 * whenever ANY dimension (`v4DebtStateSource`, `v4CollateralRiskSource`)
 * was live, the opposite polarity from `utils/protocolStatus.ts`'s own
 * `deriveProtocolStatus` (which requires EVERY dimension to be live
 * before ever reporting the composite `'live'`). A partially-live V4
 * portfolio could therefore be recorded as `'live'` here while every
 * other surface in the app called it `'manual'`. Fixed to the same
 * AND-based rule — `'live'` only when `v4DebtStateSource`,
 * `v4CollateralRiskSource`, AND `v4BaseDrawnAprSource` are all `'live'` —
 * so a mixed/manual V4 portfolio can never be misclassified as wholly
 * live in a newly-written history entry. This coarse binary `dataSource`
 * field cannot represent the field-level breakdown `deriveV4ProvenanceBreakdown`
 * now exposes elsewhere; rather than inventing new precision this field
 * was never designed to hold, it reports the same conservative
 * "'live' requires unanimous live provenance" answer every other V4
 * surface already gives. Only affects entries written from this point
 * forward — no existing persisted history record is rewritten. The V3
 * branch (an independently-invented OR rule, never flagged by this
 * batch's own audit) is untouched.
 */
function resolveDataSource(portfolio: ApplicationPortfolio): 'manual' | 'live' {
  if (portfolio.protocolVersion === 'v4') {
    return portfolio.v4DebtStateSource === 'live' &&
      portfolio.v4CollateralRiskSource === 'live' &&
      (portfolio.v4BaseDrawnAprSource ?? 'manual') === 'live'
      ? 'live'
      : 'manual';
  }
  return portfolio.marketSource === 'live' || portfolio.protocolSource === 'live'
    ? 'live'
    : 'manual';
}

function resolveDebtQuantityAndBorrowApr(portfolio: ApplicationPortfolio): {
  debtQuantity: number;
  borrowApr: number | undefined;
} {
  if (portfolio.protocolVersion === 'v4') {
    const { v4DebtState } = portfolio;
    if (v4DebtState === undefined) {
      // A V4 portfolio with no synced debt state yet — nothing to derive
      // a debt quantity or rate from. Falls back to the legacy
      // `debt.balance` scalar (always 0 for a portfolio that has never
      // had a real V4 debt state), never a fabricated non-zero value.
      return { debtQuantity: portfolio.debt.balance, borrowApr: undefined };
    }
    const debtQuantity = v4DebtState.drawnDebt + v4DebtState.premiumDebt;
    const rateStep = deriveAaveV4EffectiveBorrowRate(v4DebtState, null, 'manual');
    return { debtQuantity, borrowApr: rateStep.ok ? rateStep.value : undefined };
  }
  return { debtQuantity: portfolio.debt.balance, borrowApr: portfolio.protocol.borrowApr };
}

export function buildPortfolioHistoryEntry(
  portfolioId: string,
  portfolio: ApplicationPortfolio,
  summary: PortfolioSummary,
  now: () => string = () => new Date().toISOString(),
): PersistedPortfolioHistoryEntry {
  const { debtQuantity, borrowApr } = resolveDebtQuantityAndBorrowApr(portfolio);
  const supplyAprDisplay = resolveSupplyAprDisplay(portfolio);

  return {
    portfolioId,
    protocolVersion: portfolio.protocolVersion === 'v4' ? 'v4' : 'v3',
    createdAt: now(),
    collateral: {
      quantity: portfolio.collateral.quantity,
      valueUsd: summary.collateralValue,
    },
    debt: {
      asset: portfolio.debt.asset,
      quantity: debtQuantity,
      valueUsd: summary.debtValue,
    },
    marketPriceUsd: portfolio.market.btcPriceUsd,
    // `Infinity` (a zero-debt portfolio) is not representable in JSON —
    // `JSON.stringify` silently turns it into `null` on write, so it is
    // normalized to `null` here explicitly, matching `liquidationPriceUsd`'s
    // own "no liquidation risk" null convention. See
    // `services/persistence/types/models.ts`'s own comment on this field.
    healthFactor: Number.isFinite(summary.healthFactor) ? summary.healthFactor : null,
    liquidationPriceUsd: summary.liquidation?.price ?? null,
    loanToValue: summary.loanToValue,
    leverage: summary.leverage,
    borrowApr,
    supplyApr: supplyAprDisplay.kind === 'available' ? supplyAprDisplay.supplyApr : undefined,
    annualizedInterestCost: summary.interestCost,
    dataSource: resolveDataSource(portfolio),
  };
}

/**
 * Portfolio validation schemas — 06_TASKS.md M4-002 ("Create Portfolio
 * Validation Schemas"): "Create Zod schemas for portfolio and position
 * inputs." Dependencies: M4-001. DoD: "Invalid portfolio data is
 * rejected before reaching Services or persistence."
 *
 * Bounds mirror `engine/validation/validate.ts` (M2-005) rather than
 * inventing separate rules that could drift from what the Engine itself
 * already enforces:
 * - `collateral.quantity` / `debt.balance` — `validateTokenQuantity` /
 *   `validateNonNegative` → non-negative (M4-008 requires supporting
 *   zero-debt portfolios; zero collateral is likewise structurally
 *   valid, even though it will fail Health Factor at calculation time).
 * - `market.btcPriceUsd` — `validatePrice` → strictly positive.
 * - `protocol.maxLoanToValue` / `liquidationThreshold` —
 *   `validatePercentage` → `[0, 1]`.
 * - `protocol.borrowApr` / `supplyApr` — `validateRate` → non-negative,
 *   no stated upper bound.
 * - `maxLoanToValue <= liquidationThreshold` — the same cross-field
 *   invariant `validateProtocolParameters` already enforces
 *   (04_BUILD_GUIDE.md "Engine invariants"), surfaced here for earlier
 *   user feedback, not a new rule.
 *
 * **"Supported assets"**: collateral is locked to `'BTC'`, matching
 * `engine/shared/types.ts`'s own `CollateralPosition.asset: 'BTC'`
 * literal type. Debt asset has no Engine-level restriction
 * (`DebtPosition.asset: string`), and no task text defines a supported
 * stablecoin list. The only concrete asset list anywhere in the
 * documentation is 01_PRD.md's "PRICING PROVIDER" (REQ-010) "Supported
 * Assets": Bitcoin, Ethereum, USDC, USDT, DAI — written for the
 * (unbuilt) infrastructure price-provider layer, not specifically for
 * this validation item, but reused here as the only textual evidence
 * available for which stablecoins this application acknowledges, scoped
 * to the three actually stablecoins in that list.
 *
 * **"Duplicate positions"**: structurally impossible under Conflict A's
 * single-position model — `collateral`/`debt` are singular objects, not
 * arrays, so there is nothing to de-duplicate. No array-dedup logic is
 * written here; the type shape itself satisfies this validation item.
 *
 * **`baseCurrency` default**: `'USD'`, matching
 * `utils/env.ts`'s own `NEXT_PUBLIC_DEFAULT_CURRENCY` default — reusing
 * an existing convention, not inventing a new one.
 */
import { z } from 'zod';

const SUPPORTED_DEBT_ASSETS = ['USDC', 'USDT', 'DAI'] as const;

export const collateralPositionSchema = z.object({
  asset: z.literal('BTC'),
  quantity: z.number().finite().nonnegative(),
});

export const debtPositionSchema = z.object({
  asset: z.enum(SUPPORTED_DEBT_ASSETS),
  balance: z.number().finite().nonnegative(),
});

export const marketPricesSchema = z.object({
  btcPriceUsd: z.number().finite().positive(),
});

export const protocolParametersSchema = z
  .object({
    maxLoanToValue: z.number().finite().min(0).max(1),
    liquidationThreshold: z.number().finite().min(0).max(1),
    borrowApr: z.number().finite().nonnegative(),
    supplyApr: z.number().finite().nonnegative(),
  })
  .refine((protocol) => protocol.maxLoanToValue <= protocol.liquidationThreshold, {
    message: 'maxLoanToValue must not exceed liquidationThreshold.',
    path: ['maxLoanToValue'],
  });

export const portfolioSafetyTargetsSchema = z.object({
  targetHealthFactor: z.number().finite().positive().optional(),
  holdingPeriodDays: z.number().finite().nonnegative().optional(),
  targetBtcPriceUsd: z.number().finite().positive().optional(),
  safetyBufferPercent: z.number().finite().nonnegative().optional(),
});

export const portfolioSettingsSchema = z.object({
  safetyTargets: portfolioSafetyTargetsSchema.optional(),
});

export const portfolioInputSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required.'),
  description: z.string().optional(),
  baseCurrency: z.string().min(1).default('USD'),
  collateral: collateralPositionSchema,
  debt: debtPositionSchema,
  market: marketPricesSchema,
  protocol: protocolParametersSchema,
  settings: portfolioSettingsSchema,
});

export type PortfolioInput = z.infer<typeof portfolioInputSchema>;

export const portfolioInputUpdateSchema = portfolioInputSchema.partial();

export type PortfolioInputUpdate = z.infer<typeof portfolioInputUpdateSchema>;

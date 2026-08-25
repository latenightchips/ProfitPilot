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
 *
 * **`name`/`description` sanitized (Milestone 8 Batch 6, M8-052)** — via
 * `utils/sanitizeText.ts`'s pure `sanitizeText()` function, applied
 * directly rather than through `services/shared/sanitizeText.ts`'s Zod
 * wrapper schemas, since `types/` must not import from `services/` (see
 * that file's own header comment). This makes a Store's in-memory state
 * reflect sanitized text immediately at creation time, in addition to
 * `services/persistence/schemas/portfolio.schema.ts`'s own sanitization
 * at the write/import boundary.
 */
import { z } from 'zod';

import { sanitizeText } from '@/utils/sanitizeText';

import { SUPPORTED_DEBT_ASSETS } from './portfolio';

export const collateralPositionSchema = z.object({
  asset: z.literal('BTC'),
  quantity: z
    .number({ error: 'Enter a valid BTC quantity.' })
    .finite('Enter a valid BTC quantity.')
    .nonnegative('BTC quantity cannot be negative.'),
});

export const debtPositionSchema = z.object({
  asset: z.enum(SUPPORTED_DEBT_ASSETS),
  balance: z
    .number({ error: 'Enter a valid debt amount.' })
    .finite('Enter a valid debt amount.')
    .nonnegative('Debt amount cannot be negative.'),
});

export const marketPricesSchema = z.object({
  btcPriceUsd: z
    .number({ error: 'Enter a valid BTC price.' })
    .finite('Enter a valid BTC price.')
    .positive('BTC price must be greater than 0.'),
});

/**
 * `maxLoanToValue`/`liquidationThreshold` are stored/validated as a 0–1
 * fraction (unchanged, matches `engine/validation/validate.ts`), but the
 * UI boundary (M4-007/M4-008 forms) converts to/from a 0–100 percentage
 * for display — 06_TASKS.md UX punch-list UX-01. These messages describe
 * the percentage the user actually typed, not the internal fraction, so a
 * bound violation reads correctly regardless of which side of that
 * conversion produced it.
 */
export const protocolParametersSchema = z
  .object({
    maxLoanToValue: z
      .number({ error: 'Enter Maximum LTV as a percentage.' })
      .finite('Enter Maximum LTV as a percentage.')
      .min(0, 'Maximum LTV must be between 0% and 100%.')
      .max(1, 'Maximum LTV must be between 0% and 100%.'),
    liquidationThreshold: z
      .number({ error: 'Enter Liquidation Threshold as a percentage.' })
      .finite('Enter Liquidation Threshold as a percentage.')
      .min(0, 'Liquidation Threshold must be between 0% and 100%.')
      .max(1, 'Liquidation Threshold must be between 0% and 100%.'),
    borrowApr: z
      .number({ error: 'Enter Borrow Rate as a percentage.' })
      .finite('Enter Borrow Rate as a percentage.')
      .nonnegative('Borrow Rate cannot be negative.'),
    supplyApr: z
      .number({ error: 'Enter Supply APR as a percentage.' })
      .finite('Enter Supply APR as a percentage.')
      .nonnegative('Supply APR cannot be negative.'),
  })
  .refine((protocol) => protocol.maxLoanToValue <= protocol.liquidationThreshold, {
    message: 'Maximum LTV must not exceed Liquidation Threshold.',
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

/**
 * Aave V4 live-position identity — Stage 4A (V4 Readiness Audit §12).
 * Validates `services/portfolio/models.ts`'s `AaveV4PositionIdentity`
 * shape (see that file's own header comment for why the field is kept
 * separate from `debt`/`collateral`/`protocol`/`market` and unrelated to
 * auth identity). Standalone — still not added to `portfolioInputSchema`
 * below as of Stage 5: `stores/portfolioStore.ts`'s `setAaveV4Position`
 * (V4 Readiness Audit §12 Stage 5) validates against this schema
 * directly, the "real caller" this file's own comment anticipated, but
 * deliberately bypasses `portfolioInputSchema`/`create`/`update` entirely
 * — the same way live-synced `market`/`protocol` values never go through
 * the main creation form either. There is still no UI form for either
 * field (Stage 5's own non-goal).
 *
 * Deliberately unchecksummed (`^0x[0-9a-fA-F]{40}$`, case-insensitive) —
 * the only existing address-shape check anywhere in this repo
 * (`scripts/verifyAaveV4Snapshot.ts`) uses the same plain hex-length
 * pattern; no EIP-55 checksum or network-specific validation convention
 * exists elsewhere to mirror instead, and requiring one here would be a
 * new, unrequested rule.
 */
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export const aaveV4PositionIdentitySchema = z.object({
  userAddress: z
    .string({ error: 'Enter a valid wallet address.' })
    .regex(EVM_ADDRESS_PATTERN, 'Enter a valid wallet address.'),
});

export type AaveV4PositionIdentityInput = z.infer<typeof aaveV4PositionIdentitySchema>;

/**
 * Aave protocol version — Stage 5 (V4 Readiness Audit §12). The first Zod
 * counterpart to `engine/protocols/types.ts`'s `AaveProtocolVersion`
 * (`'v3' | 'v4'`, Stage 1) — that union has never had a schema since
 * nothing validated a runtime value against it before
 * `stores/portfolioStore.ts`'s `setProtocolVersion` (Stage 5) needed one.
 * The literal values are written out rather than derived from the TS
 * type (Zod cannot read a `type` alias at runtime), so if
 * `AaveProtocolVersion` ever gains a third version, this must be updated
 * to match by hand — the same relationship `debtPositionSchema`'s
 * `z.enum(SUPPORTED_DEBT_ASSETS)` already has with its own TS type, just
 * without a shared `as const` array to import here since
 * `AaveProtocolVersion` is a plain union, not derived from one.
 */
export const protocolVersionSchema = z.enum(['v3', 'v4']);

export type ProtocolVersionInput = z.infer<typeof protocolVersionSchema>;

/**
 * Aave V4 live debt shape — Stage 6 (V4 Readiness Audit §12). Validates
 * `services/portfolio/models.ts`'s `AaveV4DebtState` shape (see that
 * type's own doc comment for why this data exists and what closes on
 * top of it later). Bounds mirror
 * `engine/protocols/aaveV4/projectAaveV4Debt.ts`'s own validation
 * exactly, the same "mirror the Engine, don't invent a second rule"
 * discipline this file's header comment already states for every other
 * schema here: `drawnDebt`/`premiumDebt` use `validateNonNegative`;
 * `baseDrawnApr`/`riskPremium` use `validateRate` (non-negative, no
 * stated upper bound — the same bound `protocolParametersSchema`'s own
 * `borrowApr`/`supplyApr` already use for the identical Engine
 * validator).
 */
export const aaveV4DebtStateSchema = z.object({
  drawnDebt: z
    .number({ error: 'Enter a valid drawn debt amount.' })
    .finite('Enter a valid drawn debt amount.')
    .nonnegative('Drawn debt cannot be negative.'),
  premiumDebt: z
    .number({ error: 'Enter a valid premium debt amount.' })
    .finite('Enter a valid premium debt amount.')
    .nonnegative('Premium debt cannot be negative.'),
  baseDrawnApr: z
    .number({ error: 'Enter a valid base drawn rate.' })
    .finite('Enter a valid base drawn rate.')
    .nonnegative('Base drawn rate cannot be negative.'),
  riskPremium: z
    .number({ error: 'Enter a valid risk premium.' })
    .finite('Enter a valid risk premium.')
    .nonnegative('Risk premium cannot be negative.'),
  /**
   * V4 Readiness Audit §12 P1-D3 — optional, never required: manual
   * `v4DebtState` entries have no oracle to read a price from and are
   * never expected to supply one (see `AaveV4DebtState`'s own doc
   * comment in `services/portfolio/models.ts`). Only
   * `hooks/useAaveV4LiveSync.ts`'s live sync ever sets it. `.positive()`
   * mirrors the Engine's own `validatePrice` — a genuine price is never
   * zero or negative.
   */
  debtAssetPriceUsd: z
    .number({ error: 'Enter a valid debt asset price.' })
    .finite('Enter a valid debt asset price.')
    .positive('Debt asset price must be greater than zero.')
    .optional(),
});

export type AaveV4DebtStateInput = z.infer<typeof aaveV4DebtStateSchema>;

/**
 * Aave V4 collateral-risk configuration — Stage 23C (V4 Readiness Audit
 * §12). Validates `services/portfolio/models.ts`'s
 * `AaveV4CollateralRiskConfig` shape. `collateralFactor` uses the same
 * `[0, 1]` bound `protocol.maxLoanToValue`/`liquidationThreshold` already
 * use (`validatePercentage`) — it is the same kind of quantity (a
 * decimal fraction of value), just V4's, not V3's. `dynamicConfigKey` is
 * a non-negative integer (Solidity `uint32`), never a fraction.
 */
export const aaveV4CollateralRiskConfigSchema = z.object({
  collateralFactor: z
    .number({ error: 'Enter a valid collateral factor.' })
    .finite('Enter a valid collateral factor.')
    .min(0, 'Collateral factor cannot be negative.')
    .max(1, 'Collateral factor cannot exceed 100%.'),
  dynamicConfigKey: z
    .number({ error: 'Enter a valid dynamic config key.' })
    .int('Dynamic config key must be a whole number.')
    .nonnegative('Dynamic config key cannot be negative.'),
});

export type AaveV4CollateralRiskConfigInput = z.infer<typeof aaveV4CollateralRiskConfigSchema>;

/**
 * V4 data-source provenance — Stage 25 (V4 Readiness Audit §12).
 * Validates `services/portfolio/models.ts`'s `AaveV4DataSource`.
 */
export const aaveV4DataSourceSchema = z.enum(['manual', 'live']);

export const portfolioInputSchema = z.object({
  name: z
    .string()
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length > 0, { message: 'Portfolio name is required.' }),
  description: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const sanitized = sanitizeText(value);
      return sanitized.length > 0 ? sanitized : undefined;
    }),
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

/**
 * Portfolio Details form schema — 06_TASKS.md M4-006 ("Implement
 * Portfolio Details Form"): Fields "Name, Description, Base currency,
 * Default display settings, Safety target settings." DoD: "Changes
 * persist and do not alter position balances unexpectedly."
 *
 * `.pick()` from `portfolioInputSchema` rather than a hand-written
 * duplicate: this is a structural guarantee, not just a convention, that
 * the Details Form can never submit `collateral`/`debt`/`market`/
 * `protocol` changes even by coding mistake — the DoD's "do not alter
 * position balances" is enforced by the schema's own shape, not just
 * discipline in the component that uses it.
 *
 * "Default display settings" is not represented here — see conflict
 * #22 (`types/portfolio.ts`): no field list for it exists anywhere in
 * the documentation, and `PortfolioSettings` itself only models
 * `safetyTargets` for the same reason.
 */
export const portfolioDetailsSchema = portfolioInputSchema.pick({
  name: true,
  description: true,
  baseCurrency: true,
  settings: true,
});

export type PortfolioDetailsInput = z.infer<typeof portfolioDetailsSchema>;

/**
 * Collateral Position Management form schema — 06_TASKS.md M4-007,
 * narrowed by the Portfolio Live-State Cleanup batch. Fields: "Asset,
 * Quantity" — Price source/Manual price/Maximum LTV/Liquidation
 * threshold became live/read-only, synced from Aave V3 via
 * `hooks/useAaveLiveSync.ts`, not user-submitted through this form
 * anymore. `.pick()` from `portfolioInputSchema` means this form is now
 * structurally incapable of submitting `market`/`protocol`/`debt`, not
 * merely conventionally prevented by omitting inputs for them.
 */
export const collateralManagementSchema = portfolioInputSchema.pick({
  collateral: true,
});

export type CollateralManagementInput = z.infer<typeof collateralManagementSchema>;

/**
 * Debt Position Management form schema — 06_TASKS.md M4-008, narrowed by
 * the Portfolio Live-State Cleanup batch. Fields: "Asset, Debt amount" —
 * Borrow rate became live/read-only, synced from Aave V3, not
 * user-submitted through this form anymore. Same `.pick()` reasoning as
 * above, in reverse: this form can never submit
 * `collateral`/`market`/`protocol`.
 */
export const debtManagementSchema = portfolioInputSchema.pick({
  debt: true,
});

export type DebtManagementInput = z.infer<typeof debtManagementSchema>;

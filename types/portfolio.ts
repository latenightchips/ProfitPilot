/**
 * Portfolio application types — 06_TASKS.md M4-001 ("Create Portfolio
 * Application Types"): "Define application-layer portfolio models."
 * Dependencies: M3-004. DoD: "Portfolio types remain independent of
 * React and database-specific fields."
 *
 * `Portfolio` extends `ApplicationPortfolio` (`services/portfolio/models.ts`,
 * M3-004) rather than duplicating `collateral`/`debt`/`market`/`protocol` —
 * that file's own header comment explicitly anticipated this: "M4-001 may
 * — and, per its own 'Include' list, almost certainly will — extend
 * `ApplicationPortfolio` with identity/description/base-currency/settings/
 * timestamp fields later." `mapApplicationPortfolioToEngineInput`
 * (`services/portfolio/mapping.ts`) already reads only the four
 * Engine-relevant fields by name, so the extra fields below never leak
 * into the Engine by construction — no change needed there.
 *
 * **Conflict A (approved, Milestone 4 plan)**: Version 0.1 remains a
 * single collateral position and a single debt position — `collateral`/
 * `debt` stay the singular objects `ApplicationPortfolio` already
 * defines, not arrays. "Collateral positions"/"Debt positions" (plural)
 * in this task's own "Include" list is read as referring to the single
 * collateral slot and single debt slot's lifecycle management (add/edit/
 * remove one), not a multi-position collection — no weighted LTV,
 * aggregate liquidation price, or other multi-collateral math is invented
 * anywhere in this codebase (01_PRD.md REQ-003-A/B: "One object per
 * collateral asset... Version 0.1 assumes Bitcoin only" /
 * "Version 0.1 assumes one stablecoin").
 *
 * **"Settings" — documentation gap, conservatively scoped**: this task's
 * own "Include" list names "Settings" with no field definition anywhere.
 * M4-006 ("Implement Portfolio Details Form") later names "Default
 * display settings" and "Safety target settings" as form fields, and
 * M4-005 ("Implement Portfolio Creation Flow") names "Optional safety
 * targets" as a collected input — both corroborate that "Settings" holds
 * per-portfolio safety targets, but neither defines concrete field names.
 * The only concrete field list anywhere in the documentation for
 * anything resembling "safety targets" is 03_UI.md's Settings page →
 * "PORTFOLIO" section (Default Target Health Factor, Default Holding
 * Period, Default BTC Target Price, Default Safety Buffer) — described
 * there as *global application defaults* for new simulations/portfolios,
 * not explicitly a per-portfolio override schema. Reused here, scoped
 * per-portfolio, as the most conservative available interpretation
 * (reusing already-named fields, not inventing new ones) — see
 * PROJECT_STATUS.md for the full conflict writeup. "Default display
 * settings" has no field list anywhere in the documentation and is
 * therefore not modeled — `PortfolioSettings` contains only
 * `safetyTargets`, matching M4-005's own "Optional" wording.
 *
 * **Fields present here but absent from this task's own "Include"
 * list**:
 * - `archivedAt` — M4-001's list doesn't name an "archived" field, but
 *   M4-003's own "Actions" list requires "Archive" as a Store action.
 *   A minimal `archivedAt: string | null` gives that action something to
 *   write to; the full archive UX (hiding from lists, confirmation,
 *   "explain consequences") is M4-012's job, not built here.
 *
 * **Fields named in 01_PRD.md's own "PORTFOLIO MODEL" (REQ-003) but
 * intentionally not included here**: "Owner" and "Version". Neither
 * appears in this task's own "Include" list, and Version 1 has no
 * account/authentication system yet (04_BUILD_GUIDE.md "AUTHENTICATION":
 * "Anonymous users may continue using the application locally") — an
 * `ownerId` field would have nothing real to reference. Left out rather
 * than populated with an invented placeholder value; revisit alongside
 * Milestone 8's authentication work.
 */
import type { ApplicationPortfolio } from '@/services/portfolio';

export interface PortfolioSafetyTargets {
  targetHealthFactor?: number;
  holdingPeriodDays?: number;
  targetBtcPriceUsd?: number;
  safetyBufferPercent?: number;
}

export interface PortfolioSettings {
  safetyTargets?: PortfolioSafetyTargets;
}

/**
 * 01_PRD.md "PRICING PROVIDER" (REQ-010) "Supported Assets" is the only
 * concrete stablecoin list anywhere in the documentation — see
 * `types/portfolio.schema.ts`'s own header comment for the full
 * reasoning. Defined here (not in the schema file) so `Portfolio.debt`
 * can be honestly narrower than the Engine's own generic
 * `DebtPosition.asset: string` (Version 0.1 supports any stablecoin
 * string at the Engine layer, but M4-002's validation — and therefore
 * every `debt.asset` a `Portfolio` in this Store can actually hold —
 * narrows it to these three); `portfolio.schema.ts`'s `debtPositionSchema`
 * imports this same constant rather than defining a second copy.
 */
export const SUPPORTED_DEBT_ASSETS = ['USDC', 'USDT', 'DAI'] as const;

export type SupportedDebtAsset = (typeof SUPPORTED_DEBT_ASSETS)[number];

export interface Portfolio extends ApplicationPortfolio {
  id: string;
  name: string;
  description?: string;
  baseCurrency: string;
  debt: { asset: SupportedDebtAsset; balance: number };
  settings: PortfolioSettings;
  /** `null` unless archived — see this file's header comment. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

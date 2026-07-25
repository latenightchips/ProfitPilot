/**
 * Portfolio models — 06_TASKS.md M3-004 ("Implement Portfolio Mapping
 * Utilities"): "Create mapping functions between persistence models,
 * application models, and Formula Engine inputs."
 *
 * SCOPE NOTE (read before extending): M3-004 depends only on M2-002 and
 * M3-001 — it does **not** depend on M4-001 ("Define Application-Layer
 * Portfolio Models", which specifies Portfolio identity, name,
 * description, base currency, settings, and created/updated timestamps).
 * The relationship is the reverse: M4-001 depends on M3-004. So neither a
 * persistence schema nor a full application-layer model is formally
 * defined yet anywhere in the specification when this file is written.
 *
 * The types below are therefore deliberately **minimal**: exactly the
 * fields required to produce `engine`'s `PortfolioInput` (collateral,
 * debt, market, protocol), and nothing more. M4-001 may — and, per its
 * own "Include" list, almost certainly will — extend `ApplicationPortfolio`
 * with identity/description/base-currency/settings/timestamp fields later.
 * Adding those here now would be inventing M4-001's scope, not M3-004's.
 */
import type { CollateralPosition, DebtPosition, MarketPrices, ProtocolParameters } from '@/engine';

/**
 * The application-layer Portfolio shape, as far as M3-004 defines it.
 * Every field here is already validated and Engine-compatible — reusing
 * the Engine's own published domain types (`@/engine`'s
 * `CollateralPosition`/`DebtPosition`/`MarketPrices`/`ProtocolParameters`,
 * M2-002) rather than duplicating them, per this batch's instruction to
 * reuse existing shared contracts where appropriate.
 */
export interface ApplicationPortfolio {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
}

/**
 * The persistence-layer Portfolio shape, as far as M3-004 defines it.
 * Fields are optional/nullable to model real persisted data honestly —
 * a stored record may have a missing or null field (a legacy record, a
 * partially-filled draft, a malformed import) — which is exactly what
 * M3-004's "Validate required fields" Requirement exists to catch at the
 * persistence → application mapping boundary, not silently coerce.
 */
export interface PersistenceCollateralPosition {
  asset?: string | null;
  quantity?: number | null;
}

export interface PersistenceDebtPosition {
  asset?: string | null;
  balance?: number | null;
}

export interface PersistenceMarketPrices {
  btcPriceUsd?: number | null;
}

export interface PersistenceProtocolParameters {
  maxLoanToValue?: number | null;
  liquidationThreshold?: number | null;
  borrowApr?: number | null;
  supplyApr?: number | null;
}

export interface PersistencePortfolio {
  collateral?: PersistenceCollateralPosition | null;
  debt?: PersistenceDebtPosition | null;
  market?: PersistenceMarketPrices | null;
  protocol?: PersistenceProtocolParameters | null;
}

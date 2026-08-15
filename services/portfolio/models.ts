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
import type {
  AaveProtocolVersion,
  CollateralPosition,
  DebtPosition,
  MarketPrices,
  ProtocolParameters,
} from '@/engine';

/**
 * Aave V4 live-position identity — Stage 4A (V4 Readiness Audit §12).
 * The on-chain address whose V4 Spoke position a portfolio's live debt
 * figures should be read from (`infrastructure/protocols/aave/v4`'s
 * `fetchAaveV4DebtSnapshot`, Stage 3) — kept as its own, separate,
 * optional sub-object rather than a bare field on `ApplicationPortfolio`,
 * per the Stage 4 audit's own conclusion: live on-chain position identity
 * must stay structurally distinct from strategy quantities
 * (`collateral`/`debt`), market data, and protocol parameters, exactly
 * how `PortfolioSettings.safetyTargets` already keeps a different kind of
 * per-portfolio configuration in its own sub-object rather than
 * flattening it onto the record.
 *
 * **Not account/auth identity.** `userAddress` identifies which on-chain
 * position to read, not who owns this application record — deliberately
 * unrelated to `services/auth`'s `AuthUser`/`stores/authStore.ts` (a
 * Supabase email/password identity with no wallet concept at all).
 * Anonymous, fully local portfolios must be able to set this exactly like
 * signed-in ones; nothing here depends on `authStore`.
 *
 * **Does not duplicate `debt.asset`.** Which stablecoin this portfolio's
 * debt is denominated in is already owned by `ApplicationPortfolio.debt.asset`
 * — this type carries only what that field cannot already express: the
 * wallet address itself.
 *
 * `userAddress` uses the plain ambient `` `0x${string}` `` template-literal
 * type, not an import from `infrastructure/protocols/aave/v4` — the same
 * "duplicate the shape, never cross-import between layers" convention
 * `AaveProtocolVersion` already establishes between `engine/protocols/types.ts`
 * and `infrastructure/protocols/aave/types.ts`. The portfolio/domain layer
 * stays independent of RPC/ABI infrastructure by construction.
 */
export interface AaveV4PositionIdentity {
  userAddress: `0x${string}`;
}

/**
 * The application-layer Portfolio shape, as far as M3-004 defines it.
 * Every field here is already validated and Engine-compatible — reusing
 * the Engine's own published domain types (`@/engine`'s
 * `CollateralPosition`/`DebtPosition`/`MarketPrices`/`ProtocolParameters`,
 * M2-002) rather than duplicating them, per this batch's instruction to
 * reuse existing shared contracts where appropriate.
 *
 * **`protocolVersion` (V4 Readiness Audit §12 Stage 1)** — which Aave
 * protocol version this portfolio's debt is denominated under. Optional,
 * and deliberately never written by any persistence/mapping code this
 * stage (`services/persistence/*`, `mapPersistencePortfolioToApplicationPortfolio`
 * are untouched) — every currently-persisted or newly-created portfolio
 * has this field `undefined`, which every consumer must read as Aave V3
 * (backward compatible by construction, not by a migration). Stage 1 adds
 * no user-facing way to set this to `'v4'`; it exists so
 * `services/simulation/scenario.ts` has a real, typed place to resolve
 * protocol version from, and so tests can construct a V4 portfolio to
 * prove the unsupported path fails closed (§12 Stage 1 requirements).
 *
 * **`v4Position` (V4 Readiness Audit §12 Stage 4A)** — same backward-
 * compatibility discipline as `protocolVersion`: optional, and, like
 * `protocolVersion`, deliberately NOT wired into `PersistencePortfolio`/
 * `mapPersistencePortfolioToApplicationPortfolio`/`services/persistence`'s
 * write schema this stage — there is still no Store action or UI form
 * that sets it, so extending the real persistence pipeline now would be
 * schema/mapping code with no caller. Every currently-persisted or
 * newly-created portfolio has this field `undefined` today; deferred to
 * whichever later stage adds the actual Store mutation that sets it,
 * which should extend `PersistencePortfolio`/the mapping/the persistence
 * write schema together in one coherent change.
 */
export interface ApplicationPortfolio {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
  protocolVersion?: AaveProtocolVersion;
  v4Position?: AaveV4PositionIdentity;
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

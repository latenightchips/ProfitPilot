/**
 * Protocol Parameter Service — 06_TASKS.md M3-008 ("Implement Protocol
 * Parameter Service"): "Create a Service for supplying Aave protocol
 * parameters to calculations." Include: Maximum LTV, Liquidation
 * threshold, Borrow rate, Asset configuration, Data source, Freshness
 * timestamp. DoD: "No feature or Engine module hardcodes protocol
 * parameters."
 *
 * SCOPE NOTE (read before extending): same finding as M3-007 (Batch 5).
 * `04_BUILD_GUIDE.md`'s "PROTOCOL SERVICE" / "PROTOCOL ADAPTER" sections
 * describe a `ProtocolProvider` interface, an `AaveV3Provider` adapter,
 * and an `infrastructure/protocols/` directory — none of which any task
 * in `06_TASKS.md` assigns (re-checked: no task mentions
 * `infrastructure/`, `ProtocolProvider`, or `AaveV3Provider`, and no
 * task before this one creates that directory; the repository still has
 * none today). Per instruction, `04_BUILD_GUIDE.md` is architectural
 * guidance only where it doesn't conflict with actual task assignments,
 * and building an unassigned adapter/network layer would be inventing
 * scope. This file implements only the Service-layer normalization
 * logic — given already-obtained candidate parameter sets, pick one per
 * the documented fallback order and report its provenance — the same
 * boundary M3-007 drew for market prices.
 *
 * **No "freshness" classification is invented for protocol parameters,
 * unlike Market Data Service's `PriceFreshness`.** `04_BUILD_GUIDE.md`
 * defines a concrete "PRICE FRESHNESS" rule (5-minute Fresh/Stale/
 * Unavailable) for prices specifically; no equivalent
 * "PROTOCOL FRESHNESS" section exists anywhere in the document — only a
 * raw `updatedAt` timestamp field ("PROTOCOL PARAMETER MODEL") and a
 * separate, unassigned 24-hour cache-duration hint under "API CLIENT
 * RULES" (infrastructure, not built here). Inventing a staleness
 * threshold for protocol data with no documented basis would be
 * guessing at a business rule the specification doesn't state, so this
 * file reports a plain timestamp (M3-008's own "Freshness timestamp"
 * Include item) and nothing more.
 *
 * **`ProtocolQuote` wraps the Engine's own `ProtocolParameters` type
 * directly** (`@/engine`, M2-002) rather than 04_BUILD_GUIDE.md's more
 * elaborate illustrative "PROTOCOL PARAMETER MODEL" (which adds
 * `protocol`/`network`/`liquidationBonus`/`supplyApr`-as-a-named-field —
 * fields with no corresponding Engine formula or consumer anywhere in
 * this codebase, and not named in M3-008's own "Include" list). Reusing
 * the Engine's exact type means a `ProtocolQuote`'s `parameters` field
 * is already exactly what `ApplicationPortfolio.protocol` needs — no
 * separate conversion step, mirroring how `MarketQuote` (M3-007) was
 * shaped around what the rest of the Service layer actually consumes,
 * not around the Build Guide's fuller illustrative shape.
 *
 * **Fallback order** ("SERVICE FALLBACK ORDER", protocol parameters):
 * Live protocol source → Last verified configuration → Manual
 * configuration. `ProtocolOrigin` and `FALLBACK_ORDER` mirror this
 * verbatim, the same documented-not-invented pattern as `PriceOrigin`
 * (M3-007).
 *
 * **Validation mirrors the Engine's own `validateProtocolParameters`
 * invariant** (percentages in [0, 1]; `maxLoanToValue` must not exceed
 * `liquidationThreshold` — `engine/validation/validate.ts`) rather than
 * inventing a new rule. That helper is not part of the Engine's curated
 * public API (M2-031 "hide internal helpers"), so the same checks are
 * re-implemented here at the Service boundary, where — like M3-004's
 * persistence-layer mapping and M3-007's raw price candidates —
 * incoming candidate data may legitimately be malformed.
 */
import type { ProtocolParameters } from '@/engine';

import { type ApplicationError, createApplicationError } from '../shared/errors';
import type { MappingResult } from '../shared/mappingResult';

export type ProtocolOrigin = 'live' | 'cache' | 'manual';

/** `04_BUILD_GUIDE.md` "SERVICE FALLBACK ORDER": live source, then cache, then manual. */
const FALLBACK_ORDER: readonly ProtocolOrigin[] = ['live', 'cache', 'manual'];

export interface RawProtocolCandidate {
  origin: ProtocolOrigin;
  parameters: ProtocolParameters;
  /** ISO 8601. */
  timestamp: string;
}

export interface ProtocolQuoteAvailable {
  available: true;
  collateralAsset: string;
  borrowAsset: string;
  parameters: ProtocolParameters;
  origin: ProtocolOrigin;
  timestamp: string;
}

export interface ProtocolQuoteUnavailable {
  available: false;
  collateralAsset: string;
  borrowAsset: string;
}

export type ProtocolQuote = ProtocolQuoteAvailable | ProtocolQuoteUnavailable;

export interface NormalizeProtocolQuoteInput {
  collateralAsset: string;
  borrowAsset: string;
  candidates: RawProtocolCandidate[];
}

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPercentage(value: number): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNonNegativeRate(value: number): boolean {
  return isFiniteNumber(value) && value >= 0;
}

/**
 * Normalizes candidate protocol-parameter sets from up to three origins
 * into one, provider-agnostic `ProtocolQuote` — 06_TASKS.md M3-008.
 */
export function normalizeProtocolQuote(
  input: NormalizeProtocolQuoteInput,
): MappingResult<ProtocolQuote> {
  const errors: ApplicationError[] = [];
  const validCandidates: RawProtocolCandidate[] = [];

  for (const candidate of input.candidates) {
    const { parameters } = candidate;

    if (!isPercentage(parameters.maxLoanToValue)) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_MAX_LTV_INVALID',
          `Candidate maxLoanToValue for origin "${candidate.origin}" must be a decimal between 0 and 1.`,
        ),
      );
      continue;
    }
    if (!isPercentage(parameters.liquidationThreshold)) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_LIQUIDATION_THRESHOLD_INVALID',
          `Candidate liquidationThreshold for origin "${candidate.origin}" must be a decimal between 0 and 1.`,
        ),
      );
      continue;
    }
    if (parameters.maxLoanToValue > parameters.liquidationThreshold) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_MAX_LTV_EXCEEDS_THRESHOLD',
          `Candidate maxLoanToValue for origin "${candidate.origin}" must not exceed liquidationThreshold.`,
        ),
      );
      continue;
    }
    if (!isNonNegativeRate(parameters.borrowApr)) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_BORROW_APR_INVALID',
          `Candidate borrowApr for origin "${candidate.origin}" must be a non-negative finite number.`,
        ),
      );
      continue;
    }
    if (!isNonNegativeRate(parameters.supplyApr)) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_SUPPLY_APR_INVALID',
          `Candidate supplyApr for origin "${candidate.origin}" must be a non-negative finite number.`,
        ),
      );
      continue;
    }
    if (Number.isNaN(Date.parse(candidate.timestamp))) {
      errors.push(
        createApplicationError(
          'validation',
          'PROTOCOL_QUOTE_TIMESTAMP_INVALID',
          `Candidate timestamp for origin "${candidate.origin}" must be a valid ISO 8601 timestamp.`,
        ),
      );
      continue;
    }

    validCandidates.push(candidate);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  let chosen: RawProtocolCandidate | undefined;
  for (const origin of FALLBACK_ORDER) {
    chosen = validCandidates.find((candidate) => candidate.origin === origin);
    if (chosen !== undefined) break;
  }

  if (chosen === undefined) {
    return {
      ok: true,
      data: {
        available: false,
        collateralAsset: input.collateralAsset,
        borrowAsset: input.borrowAsset,
      },
    };
  }

  return {
    ok: true,
    data: {
      available: true,
      collateralAsset: input.collateralAsset,
      borrowAsset: input.borrowAsset,
      parameters: chosen.parameters,
      origin: chosen.origin,
      timestamp: chosen.timestamp,
    },
  };
}

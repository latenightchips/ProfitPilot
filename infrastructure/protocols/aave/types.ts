import type { RawPriceCandidate, RawProtocolCandidate } from '@/services';

/**
 * Aave adapter boundary — shared across every protocol-version-specific
 * adapter (`./v3`, and a future `./v4`). 04_BUILD_GUIDE.md: "Keep financial
 * calculations out of infrastructure code" — this layer only fetches,
 * decodes, and unit-converts raw contract data into the same
 * `RawPriceCandidate`/`RawProtocolCandidate` shape the rest of the
 * pricing/protocol-provider system already uses. Any accrual/compounding
 * math belongs in `engine/protocols/aaveV3/`, not here.
 */
export type AaveProtocolVersion = 'v3';

export interface AaveSourceMetadata {
  protocol: 'aave';
  version: AaveProtocolVersion;
  network: string;
  method: 'rpc';
  /** The block every read in this snapshot was pinned to, for internal consistency. Stringified — bigint doesn't survive JSON. */
  blockNumber: string;
}

export interface AaveAdapterData {
  priceCandidate: RawPriceCandidate;
  protocolCandidate: RawProtocolCandidate;
  collateralSymbol: string;
  borrowSymbol: string;
  source: AaveSourceMetadata;
}

export interface AaveAdapterError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export type AaveAdapterResult =
  { ok: true; data: AaveAdapterData } | { ok: false; error: AaveAdapterError };

export interface AaveAdapter {
  version: AaveProtocolVersion;
  fetchReserveSnapshot(borrowAssetSymbol: string): Promise<AaveAdapterResult>;
}

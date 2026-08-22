import { create } from 'zustand';

import type { AaveV4PositionApiResponse } from '@/app/api/aave/v4-position/route';

/**
 * Aave V4 Live Data Store — V4 Readiness Audit §12 Stage 7. Mirrors
 * `stores/aaveLiveDataStore.ts`'s own shape and discipline exactly, one
 * layer down: fetches from the same-origin `/api/aave/v4-position` Route
 * Handler (Stage 4B) — never the Aave V4 contracts directly from the
 * browser, the RPC call happens server-side, see that route's own header
 * comment.
 *
 * **Keyed by identity (`userAddress` + `debtAsset`), not just asset.**
 * `useAaveLiveDataStore` only needed an asset-switch guard because V3's
 * identity is implicit (there is no per-wallet V3 read). V4 genuinely
 * reads a specific wallet's position, so a stale in-flight response must
 * be rejected if EITHER the address or the asset has since changed —
 * `hooks/useAaveV4LiveSync.ts`'s own sync effect re-checks both
 * `userAddress`/`debtAsset` against the calling portfolio's current
 * configuration before ever writing this store's `engineInputs` into
 * portfolio state, the same "preserve wallet/chain/market position
 * identity boundaries" requirement this stage was given. The
 * `latestRequestId` guard below additionally protects against a stale
 * in-flight response landing after a *newer* request already resolved,
 * mirroring `useAaveLiveDataStore`'s own request-id guard.
 *
 * **"On API failure, do not erase existing data"** — identical
 * reasoning to `useAaveLiveDataStore`'s own header comment: every
 * error-path `set()` call below omits `engineInputs`/`userAddress`/
 * `debtAsset`/`lastFetchedAt` entirely, so whatever was last successfully
 * fetched (and when) stays in state under an `'error'` status.
 *
 * **`lastFetchedAt` (V4 Readiness Audit §12 Stage 17)** — the ISO 8601
 * instant of the last *successful* fetch, `null` until one has ever
 * landed. V4 has no per-field "as-of" timestamp the way a V3 price
 * candidate does (`services/market/quote.ts`'s own `RawPriceCandidate.timestamp`,
 * whose age is what `normalizeMarketQuote` actually classifies) — a V4
 * position read is a single synchronous on-chain snapshot with no
 * independent origin/timestamp of its own. So instead of reusing that
 * machinery directly, `utils/protocolStatus.ts` applies the same
 * `FRESHNESS_THRESHOLD_MINUTES` window to this store's own fetch time,
 * so the "Aave V4 · Live" badge cannot keep describing an old snapshot
 * indefinitely just because no error has occurred to change the status.
 * No polling was added to keep this "live" in real time — the check is
 * simply re-evaluated, correctly, on whatever render happens to occur.
 */
export type AaveV4LiveDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveV4EngineDebtInputsData {
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
}

export interface AaveV4LiveDataState {
  status: AaveV4LiveDataStatus;
  engineInputs: AaveV4EngineDebtInputsData | null;
  userAddress: `0x${string}` | null;
  debtAsset: string | null;
  errorMessage: string | null;
  /**
   * V4 Readiness Audit §12 — P0-4. The classified `AAVE_V4_*` code
   * (`ApplicationError.code`) behind the current `errorMessage`, `null`
   * for the one case with no classified error to report — the
   * network-level `catch` below, where `fetch` itself failed before any
   * server response (and therefore any `ApplicationError`) ever existed.
   * Preserved alongside `errorMessage` (never a second, competing error
   * string) purely so a consumer can distinguish/log by code without
   * parsing the display message.
   */
  errorCode: string | null;
  /**
   * V4 Readiness Audit §12 — P0-4. The identity a fetch attempt was FOR,
   * set at the start of every `fetchAaveV4LiveData` call (success or
   * failure) and left untouched afterward — unlike `userAddress`/
   * `debtAsset` above, which only ever update on a SUCCESS (by design,
   * see this file's own "on API failure, do not erase existing data"
   * header comment) and therefore cannot reliably identify which
   * identity a FAILED attempt was for. `hooks/useAaveV4LiveSync.ts`
   * compares these against the calling portfolio's own current identity
   * before ever attributing an error to it — the same "never surface a
   * stale/foreign identity's error" guard `userAddress`/`debtAsset`
   * already provide for successful writes, extended to the error path.
   */
  attemptedUserAddress: `0x${string}` | null;
  /** Same role as `attemptedUserAddress` above, for `debtAsset`. */
  attemptedDebtAsset: string | null;
  /** ISO 8601 instant of the last successful fetch — see header comment. */
  lastFetchedAt: string | null;
  fetchAaveV4LiveData: (userAddress: `0x${string}`, debtAsset: string) => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave V4 data is temporarily unavailable.';

let latestRequestId = 0;

export const useAaveV4LiveDataStore = create<AaveV4LiveDataState>((set) => ({
  status: 'idle',
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,
  errorCode: null,
  attemptedUserAddress: null,
  attemptedDebtAsset: null,
  lastFetchedAt: null,

  fetchAaveV4LiveData: async (userAddress: `0x${string}`, debtAsset: string) => {
    const requestId = ++latestRequestId;
    set({ status: 'loading', attemptedUserAddress: userAddress, attemptedDebtAsset: debtAsset });

    let body: AaveV4PositionApiResponse;
    try {
      const response = await fetch(
        `/api/aave/v4-position?userAddress=${encodeURIComponent(userAddress)}&debtAsset=${encodeURIComponent(debtAsset)}`,
      );
      body = (await response.json()) as AaveV4PositionApiResponse;
    } catch {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', errorMessage: GENERIC_ERROR_MESSAGE, errorCode: null });
      return;
    }

    if (requestId !== latestRequestId) return;

    if (!body.ok || body.data === undefined) {
      set({
        status: 'error',
        errorMessage: body.errors?.[0]?.message ?? GENERIC_ERROR_MESSAGE,
        errorCode: body.errors?.[0]?.code ?? null,
      });
      return;
    }

    set({
      status: 'ready',
      engineInputs: body.data.engineInputs,
      userAddress,
      debtAsset,
      errorMessage: null,
      errorCode: null,
      lastFetchedAt: new Date().toISOString(),
    });
  },
}));

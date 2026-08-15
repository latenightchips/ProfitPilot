/**
 * Minimal ABI fragments — transcribed verbatim from the interfaces
 * verified against `aave/aave-v4` (commit
 * `2524fe4018a42750300e114f2a8c4355df62a878`):
 *   - `src/hub/interfaces/IHubBase.sol` / `IHub.sol` — `getAssetId`,
 *     `getAssetDrawnRate`, `error AssetNotListed()`
 *   - `src/spoke/interfaces/ISpoke.sol` — `getReserveId`, `getUserDebt`,
 *     `getUserLastRiskPremium`, `getUserReserveStatus`, `getReserve`,
 *     `error ReserveNotListed()`
 * Only the functions this read-only adapter actually calls — no state-
 * changing functions are represented (Stage 3 is read-only by design).
 *
 * **Custom errors are included deliberately** (Stage 3 hardening review,
 * item 1/6) — `Hub.sol`'s `getAssetId` (`require(isUnderlyingListed(...),
 * AssetNotListed())`) and `Spoke.sol`'s `getReserveId`
 * (`require(_isAssetIdListed(...), ReserveNotListed())`) both revert with
 * these exact zero-argument custom errors, verified directly against the
 * implementation contracts (not just the interfaces), when an asset/
 * reserve genuinely does not exist — never a sentinel/default return
 * value. Declaring them here lets viem decode a revert's `errorName`
 * (`ContractFunctionRevertedError.data.errorName`), so `./client.ts`'s
 * error classifier can distinguish "genuinely not listed here" (safe to
 * treat as absence during Hub/reserve discovery) from every other
 * contract-level revert or RPC/transport failure (which must NOT be
 * silently treated as absence — see `./index.ts`'s `resolveV4Reserve`).
 */

/** `IHubBase.getAssetId` — reverts with `AssetNotListed` if unlisted (`Hub.sol` line 497). */
export const hubGetAssetIdAbi = [
  {
    name: 'getAssetId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'underlying', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { name: 'AssetNotListed', type: 'error', inputs: [] },
] as const;

/**
 * `IHub.getAssetDrawnRate` — the Hub asset's current RAY-scaled drawn
 * rate (`Asset.drawnRate`). Declared on `IHub`, not `IHubBase` — only
 * a full Hub exposes this read (`IHubBase` is the Spoke-facing minimal
 * surface).
 */
export const hubGetAssetDrawnRateAbi = [
  {
    name: 'getAssetDrawnRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assetId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** `ISpoke.getReserveId` — reverts with `ReserveNotListed` if no reserve exists for the (hub, assetId) pair (`Spoke.sol` line 531). */
export const spokeGetReserveIdAbi = [
  {
    name: 'getReserveId',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'hub', type: 'address' },
      { name: 'assetId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { name: 'ReserveNotListed', type: 'error', inputs: [] },
] as const;

/**
 * `ISpoke.getUserDebt` — live-computed (as of the read's block) drawn and
 * premium debt for one user/reserve, already resolved to asset units by
 * the Spoke itself. Verified directly against `Spoke.sol`'s
 * implementation:
 *
 * ```solidity
 * function getUserDebt(uint256 reserveId, address user) external view returns (uint256, uint256) {
 *   Reserve storage reserve = _reserves.get(reserveId);
 *   UserPosition storage userPosition = _userPositions[user][reserveId];
 *   (uint256 drawnDebt, uint256 premiumDebtRay) = userPosition.getDebt(reserve.hub, reserve.assetId);
 *   return (drawnDebt, premiumDebtRay.fromRayUp());
 * }
 * ```
 *
 * `UserPositionUtils.getDebt(userPosition, hub, assetId)` calls
 * `hub.getAssetDrawnIndex(assetId)` (the CURRENT, live-projected index —
 * not a stale checkpoint) and returns
 * `(userPosition.drawnShares.rayMulUp(drawnIndex), premiumDebtRay)` —
 * i.e. both returned values are already CURRENT, full asset-unit debt
 * BALANCES (drawnShares × current index; premium already `.fromRayUp()`'d
 * to asset units), never raw share counts and never a delta. Feeding
 * these directly into `projectAaveV4Debt` as its `drawnDebt`/`premiumDebt`
 * "current balance at t0" inputs is exactly correct: that function's own
 * growth factor starts at 1.0 (no growth) at `elapsedDays=0` and only
 * compounds forward from t0, so there is no double-application of the
 * index growth already baked into these values, and no share/debt
 * confusion (Stage 3 hardening review item 2).
 */
export const spokeGetUserDebtAbi = [
  {
    name: 'getUserDebt',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'drawnDebt', type: 'uint256' },
      { name: 'premiumDebt', type: 'uint256' },
    ],
  },
] as const;

/**
 * `ISpoke.getUserLastRiskPremium` — "the risk premium from the user's
 * last position update" (`ISpoke.sol`'s own doc comment), reading
 * `_positionStatus[user].riskPremium` directly (confirmed in `Spoke.sol`
 * line 629). Written ONLY by `_notifyRiskPremiumUpdate` (`Spoke.sol` line
 * 822), which ATOMICALLY, in the same call, both sets
 * `positionStatus.riskPremium` AND refreshes every borrowed reserve's
 * `premiumShares`/`premiumOffsetRay` to match (via
 * `userPosition.calculatePremiumDelta({riskPremium: newRiskPremium, ...})`
 * for each reserve `positionStatus.nextBorrowing` iterates) — called from
 * `borrow`, `withdraw`, `liquidationCall`, `setUsingAsCollateral`,
 * `updateUserRiskPremium`, `updateUserDynamicConfig` (never `supply`/
 * `repay`, matching `docs/overview.md`'s own stated trigger list). This
 * proves `getUserLastRiskPremium` is never stale relative to the
 * position's actual premium accounting — it is the exact value the
 * position's premium debt is (and will keep) accruing against, not merely
 * a UI/account-status figure (Stage 3 hardening review item 3). Expressed
 * in BPS.
 */
export const spokeGetUserLastRiskPremiumAbi = [
  {
    name: 'getUserLastRiskPremium',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** `ISpoke.getUserReserveStatus` — used to fail closed on missing position state (neither supplied nor borrowed). */
export const spokeGetUserReserveStatusAbi = [
  {
    name: 'getUserReserveStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'usingAsCollateral', type: 'bool' },
      { name: 'borrowed', type: 'bool' },
    ],
  },
] as const;

/** `ISpoke.getReserve` — used to cross-check `decimals` against the hardcoded asset registry, mirroring the V3 adapter's own decimals cross-check. */
export const spokeGetReserveAbi = [
  {
    name: 'getReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reserveId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'underlying', type: 'address' },
          { name: 'hub', type: 'address' },
          { name: 'assetId', type: 'uint16' },
          { name: 'decimals', type: 'uint8' },
          { name: 'collateralRisk', type: 'uint24' },
          { name: 'flags', type: 'uint8' },
          { name: 'dynamicConfigKey', type: 'uint32' },
        ],
      },
    ],
  },
] as const;

/** Standard ERC20 `decimals()` — used to cross-check hardcoded asset decimals, mirroring `../v3/abi.ts`. */
export const erc20Abi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

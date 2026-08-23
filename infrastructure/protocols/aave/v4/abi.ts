/**
 * Minimal ABI fragments — transcribed verbatim from the interfaces
 * verified against `aave/aave-v4` (commit
 * `2524fe4018a42750300e114f2a8c4355df62a878`):
 *   - `src/hub/interfaces/IHubBase.sol` / `IHub.sol` — `getAssetId`,
 *     `getAssetDrawnRate`, `error AssetNotListed()`
 *   - `src/spoke/interfaces/ISpoke.sol` — `getReserveId`, `getUserDebt`,
 *     `getUserLastRiskPremium`, `getUserReserveStatus`, `getReserve`,
 *     `getUserPosition`, `getDynamicReserveConfig`, `error ReserveNotListed()`
 * Only the functions this read-only adapter actually calls — no state-
 * changing functions are represented (Stage 3 is read-only by design).
 *
 * **`getUserPosition`/`getDynamicReserveConfig` (V4 Readiness Audit §12
 * Stage 23C)** — added to close the Stage 23 finding that Health
 * Factor/liquidation calculations had no source for V4's actual
 * collateral-risk parameter. Verified directly against `ISpoke.sol`
 * (`struct UserPosition`, `struct DynamicReserveConfig`, both interface
 * declarations) at the same pinned commit above, during Stage 23B's own
 * primary-source research — see `./index.ts`'s
 * `fetchAaveV4CollateralRiskSnapshot` for the full reasoning on why both
 * reads are needed together and in this order.
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

/**
 * `ISpoke.getUserPosition` — the raw per-user, per-reserve position
 * struct, verified against `ISpoke.sol`'s own `struct UserPosition`
 * declaration. This adapter reads it ONLY for `dynamicConfigKey` — the
 * user's own bound dynamic-config snapshot (Stage 23B's own research:
 * `_processUserAccountData` in `Spoke.sol` uses exactly this field, not
 * the reserve's current `dynamicConfigKey`, for every read-only Health
 * Factor/account-data call). The other four fields (`drawnShares`/
 * `premiumShares`/`premiumOffsetRay`/`suppliedShares`) are decoded
 * because viem must decode the full tuple, but are not currently
 * consumed anywhere — `getUserDebt` (already used above) is this
 * adapter's real source for drawn/premium debt, already resolved to
 * asset units by the Spoke itself, so nothing here duplicates that.
 */
export const spokeGetUserPositionAbi = [
  {
    name: 'getUserPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'drawnShares', type: 'uint120' },
          { name: 'premiumShares', type: 'uint120' },
          { name: 'premiumOffsetRay', type: 'int200' },
          { name: 'suppliedShares', type: 'uint120' },
          { name: 'dynamicConfigKey', type: 'uint32' },
        ],
      },
    ],
  },
] as const;

/**
 * `ISpoke.getDynamicReserveConfig` — the exact bound configuration for
 * one reserve at one specific `dynamicConfigKey`, verified against
 * `ISpoke.sol`'s own `struct DynamicReserveConfig` declaration.
 * `ISpoke.sol`'s own doc comment for this function: "Does not revert if
 * `dynamicConfigKey` is unset" — an uninitialized key returns a zeroed
 * struct (`collateralFactor: 0`), not a revert, so a genuinely-zero
 * on-chain answer and "never configured" are indistinguishable at this
 * layer; both are passed through as real, unfabricated data, never
 * special-cased into a synthetic "unavailable" here.
 */
export const spokeGetDynamicReserveConfigAbi = [
  {
    name: 'getDynamicReserveConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'dynamicConfigKey', type: 'uint32' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'collateralFactor', type: 'uint16' },
          { name: 'maxLiquidationBonus', type: 'uint32' },
          { name: 'liquidationFee', type: 'uint16' },
        ],
      },
    ],
  },
] as const;

/**
 * `ISpoke.ORACLE()` — the address of the Spoke's own bound price oracle
 * (V4 Readiness Audit §12 P1-B). Verified directly against `ISpoke.sol`
 * (`function ORACLE() external view returns (address);`) and
 * `AaveOracle.sol`'s `setSpoke` (`require(ISpoke(spoke_).ORACLE() ==
 * address(this), OracleMismatch())`) at the same pinned commit as every
 * other ABI fragment in this file.
 *
 * **Oracles are Spoke-specific, not global — verified from primary
 * source, not assumed from V3.** `AaveOracle.sol`'s own doc comment:
 * "Oracles are spoke-specific, due to the usage of reserve id as index of
 * the `_sources` mapping." Each Spoke is bound to exactly one `AaveOracle`
 * instance at deployment (`setSpoke` is callable only once, by the
 * deployer) — there is no single pool-wide oracle the way V3's
 * `AaveOracle` is shared across the whole V3 Pool. This is why the
 * adapter must read `ORACLE()` from the Spoke it already has, rather than
 * being handed (or hardcoding) an oracle address.
 */
export const spokeOracleAbi = [
  {
    name: 'ORACLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

/**
 * `IPriceOracle.decimals()` / `IPriceOracle.getReservePrice(uint256)` —
 * verified directly against `IPriceOracle.sol` (V4 Readiness Audit §12
 * P1-B, same pinned commit). `IPriceOracle`'s own doc comment: "All
 * prices must use the same number of decimals as the oracle and should be
 * returned in the same currency" — `decimals()` is read live rather than
 * assumed, per this stage's own instruction not to hardcode the reference
 * implementation's `SpokeUtils.ORACLE_DECIMALS = 8` constant into
 * production logic.
 *
 * **`getReservePrice` takes a `reserveId`, not an asset address** — a
 * genuinely different signature from V3's `AaveOracle.getAssetPrice(address)`
 * (`../v3/abi.ts`'s `aaveOracleAbi`), not a renamed copy of it. This
 * adapter already resolves the collateral reserve's `reserveId` via
 * `resolveV4Reserve` (`./index.ts`) for `getUserPosition`/
 * `getDynamicReserveConfig` — the oracle price read reuses that exact
 * same `reserveId`, no separate resolution.
 *
 * **`InvalidPrice`/`InvalidSource` (from `IAaveOracle.sol`, the concrete
 * interface `AaveOracle.sol` implements) are included deliberately**,
 * mirroring this file's existing `AssetNotListed`/`ReserveNotListed`
 * inclusion (see this file's own header comment) — so a revert here
 * decodes to a real error name instead of an opaque short message.
 * Verified directly against `AaveOracle.sol`'s `_getSourcePrice`:
 * `require(address(source) != address(0), InvalidSource(reserveId))` and
 * `require(price > 0, InvalidPrice(reserveId))` — a non-positive feed
 * answer REVERTS, it is never returned as a sentinel zero. Neither error
 * is treated as a "not listed here" discovery signal (unlike
 * `AssetNotListed`/`ReserveNotListed`) — both fall through to this
 * adapter's generic `AAVE_V4_RPC_CONTRACT_ERROR` classification, which is
 * the correct outcome: an invalid/missing price source is a genuine
 * failure, never a signal to silently continue.
 */
export const priceOracleAbi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'getReservePrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reserveId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { name: 'InvalidSource', type: 'error', inputs: [{ name: 'reserveId', type: 'uint256' }] },
  { name: 'InvalidPrice', type: 'error', inputs: [{ name: 'reserveId', type: 'uint256' }] },
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

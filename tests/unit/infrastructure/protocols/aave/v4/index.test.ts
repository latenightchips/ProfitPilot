import { ContractFunctionRevertedError, HttpRequestError, TimeoutError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV4DebtSnapshot } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_ETHEREUM_HUBS } from '@/infrastructure/protocols/aave/v4/addresses';
import type { AaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';

const USER = '0x1111111111111111111111111111111111111111' as const;

function notListedError(
  errorName: 'AssetNotListed' | 'ReserveNotListed',
): ContractFunctionRevertedError {
  const err = new ContractFunctionRevertedError({ abi: [], functionName: 'x' });
  // @ts-expect-error -- `data` is writable at runtime; viem's own decoder assigns it the same way.
  err.data = { errorName, args: [] };
  return err;
}

function genericRevertError(): ContractFunctionRevertedError {
  const err = new ContractFunctionRevertedError({ abi: [], functionName: 'x' });
  // @ts-expect-error -- see notListedError.
  err.data = { errorName: 'SomeOtherRevert', args: [] };
  return err;
}

function timeoutError(): TimeoutError {
  return new TimeoutError({ body: {}, url: 'https://example.invalid' });
}

function networkError(): HttpRequestError {
  return new HttpRequestError({ url: 'https://example.invalid' });
}

interface MockConfig {
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  assetIdListedOnHub?: `0x${string}`;
  /** Error thrown by getAssetId for every Hub OTHER than `assetIdListedOnHub` — defaults to a decoded AssetNotListed revert. */
  assetIdFailureForOtherHubs?: () => Error;
  assetId?: bigint;
  reserveId?: bigint;
  reserveDecimals?: number;
  liveDecimals?: number;
  drawnDebtRaw?: bigint;
  premiumDebtRaw?: bigint;
  drawnRateRay?: bigint;
  riskPremiumBps?: bigint;
  borrowed?: boolean;
  usingAsCollateral?: boolean;
  collateralRisk?: number;
  /** `ISpoke.ORACLE()` — V4 Readiness Audit §12 P1-D1. */
  oracle?: `0x${string}`;
  /** `IPriceOracle.decimals()`. */
  oracleDecimals?: number;
  /** `IPriceOracle.getReservePrice(reserveId)`, raw integer at `oracleDecimals` precision. */
  debtAssetPriceRaw?: bigint;
}

const DEFAULT_ORACLE = '0x9999999999999999999999999999999999999999' as const;

/**
 * Routes readContract calls by functionName + address, mirroring
 * `../v3/index.test.ts`'s own `buildClient` pattern. `getAssetId` only
 * "succeeds" for `assetIdListedOnHub` (default `CORE_HUB`) — every other
 * Hub candidate throws `assetIdFailureForOtherHubs()` (default: a decoded
 * `AssetNotListed` revert), exercising the real multi-Hub probe in
 * `./index.ts`'s `resolveV4Reserve`, not a stubbed-out single call.
 */
function buildClient(overrides?: MockConfig): {
  client: AaveV4RpcClient;
  readContract: ReturnType<typeof vi.fn>;
  getBlock: ReturnType<typeof vi.fn>;
} {
  const blockNumber = overrides?.blockNumber ?? 21_000_000n;
  const blockTimestamp = overrides?.blockTimestamp ?? 1_700_000_000n;
  const assetIdListedOnHub =
    overrides?.assetIdListedOnHub ?? (AAVE_V4_ETHEREUM_HUBS.CORE as `0x${string}`);
  const assetIdFailureForOtherHubs =
    overrides?.assetIdFailureForOtherHubs ?? (() => notListedError('AssetNotListed'));
  const assetId = overrides?.assetId ?? 7n;
  const reserveId = overrides?.reserveId ?? 42n;
  const reserveDecimals = overrides?.reserveDecimals ?? 6;
  const liveDecimals = overrides?.liveDecimals ?? 6;
  const drawnDebtRaw = overrides?.drawnDebtRaw ?? 20_000_000_000n; // 20,000 @ 6 decimals
  const premiumDebtRaw = overrides?.premiumDebtRaw ?? 500_000_000n; // 500 @ 6 decimals
  const drawnRateRay = overrides?.drawnRateRay ?? 50_000_000_000_000_000_000_000_000n; // 0.05
  const riskPremiumBps = overrides?.riskPremiumBps ?? 1000n; // 10%
  const borrowed = overrides?.borrowed ?? true;
  const usingAsCollateral = overrides?.usingAsCollateral ?? true;
  const collateralRisk = overrides?.collateralRisk ?? 500;
  const oracle = overrides?.oracle ?? DEFAULT_ORACLE;
  const oracleDecimals = overrides?.oracleDecimals ?? 8;
  const debtAssetPriceRaw = overrides?.debtAssetPriceRaw ?? 99_980_000n; // $0.9998 at 8 decimals

  const getBlock = vi.fn().mockImplementation(async (params?: { blockNumber?: bigint }) => {
    if (params?.blockNumber !== undefined) {
      return { number: params.blockNumber, timestamp: blockTimestamp };
    }
    return { number: blockNumber, timestamp: blockTimestamp };
  });

  const readContract = vi.fn().mockImplementation(async ({ functionName, address, args }) => {
    if (functionName === 'getAssetId') {
      if (String(address).toLowerCase() === assetIdListedOnHub.toLowerCase()) {
        return assetId;
      }
      throw assetIdFailureForOtherHubs();
    }
    if (functionName === 'getReserveId') {
      return reserveId;
    }
    if (functionName === 'getReserve') {
      return {
        underlying: '0x0000000000000000000000000000000000d00d',
        hub: assetIdListedOnHub,
        assetId: Number(assetId),
        decimals: reserveDecimals,
        collateralRisk,
        flags: 0,
        dynamicConfigKey: 0,
      };
    }
    if (functionName === 'getUserDebt') {
      return [drawnDebtRaw, premiumDebtRaw];
    }
    if (functionName === 'getAssetDrawnRate') {
      return drawnRateRay;
    }
    if (functionName === 'getUserLastRiskPremium') {
      return riskPremiumBps;
    }
    if (functionName === 'getUserReserveStatus') {
      return [usingAsCollateral, borrowed];
    }
    if (functionName === 'ORACLE') {
      return oracle;
    }
    if (functionName === 'decimals') {
      // Two DIFFERENT contracts both expose `decimals()`: the ERC20
      // underlying (`fetchTokenDecimals`, `liveDecimals`) and the oracle
      // (`fetchOracleDecimals`, V4 Readiness Audit §12 P1-D1) —
      // distinguished by address, never conflated.
      if (String(address).toLowerCase() === oracle.toLowerCase()) {
        return oracleDecimals;
      }
      return liveDecimals;
    }
    if (functionName === 'getReservePrice') {
      // Proves the price read reuses the exact same (DEBT) reserveId
      // already resolved for getUserDebt/getReserve/etc. above — never
      // the collateral reserveId, which this test suite never resolves
      // at all.
      expect(args[0]).toBe(reserveId);
      return debtAssetPriceRaw;
    }
    throw new Error(`Unexpected functionName in test: ${functionName}`);
  });

  return {
    client: {
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
      getBlock: getBlock as unknown as AaveV4RpcClient['getBlock'],
    },
    readContract,
    getBlock,
  };
}

describe('fetchAaveV4DebtSnapshot — WBTC collateral / USDC debt', () => {
  it('returns a full snapshot when every read succeeds and decimals match', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.engineInputs.drawnDebt).toBeCloseTo(20000, 6);
    expect(result.data.engineInputs.premiumDebt).toBeCloseTo(500, 6);
    expect(result.data.engineInputs.baseDrawnApr).toBeCloseTo(0.05, 6);
    expect(result.data.engineInputs.riskPremium).toBeCloseTo(0.1, 6);
    expect(result.data.display.debtSymbol).toBe('USDC');
    expect(result.data.display.collateralSymbol).toBe('WBTC');
    expect(result.data.display.blockNumber).toBe('21000000');
    expect(result.data.debtAssetPriceUsd).toBeCloseTo(0.9998, 8);
  });
});

describe('fetchAaveV4DebtSnapshot — WBTC collateral / USDT debt', () => {
  it('returns a full snapshot for the USDT reserve, addressed and labeled distinctly from USDC', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'USDT', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.display.debtSymbol).toBe('USDT');

    const decimalsCalls = readContract.mock.calls.filter(([a]) => a.functionName === 'decimals');
    expect(decimalsCalls.length).toBeGreaterThan(0);
  });
});

describe('fetchAaveV4DebtSnapshot — same-block enforcement', () => {
  it('pins every subsequent read to the block number fetched at the start of the snapshot', async () => {
    const { client, readContract, getBlock } = buildClient({ blockNumber: 22_222_222n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);

    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalled();
    for (const call of readContract.mock.calls) {
      expect(call[0]).toMatchObject({ blockNumber: 22_222_222n });
    }
  });

  it('supports pinning to an explicit historical block, skipping the latest-block fetch', async () => {
    const { client, getBlock } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER, 18_500_000n);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.display.blockNumber).toBe('18500000');
    expect(getBlock).toHaveBeenCalledWith({ blockNumber: 18_500_000n });
  });
});

describe('fetchAaveV4DebtSnapshot — unsupported debt asset', () => {
  it('fails closed with AAVE_V4_UNSUPPORTED_DEBT_ASSET for DAI, without attempting any RPC reads', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'DAI', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_UNSUPPORTED_DEBT_ASSET');
    expect(result.error.retryable).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('fails closed with AAVE_V4_UNSUPPORTED_DEBT_ASSET for an unrecognized symbol', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'NOT_A_REAL_ASSET', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_UNSUPPORTED_DEBT_ASSET');
  });
});

describe('fetchAaveV4DebtSnapshot — malformed/partial contract response', () => {
  it('propagates a block fetch failure without attempting any further reads', async () => {
    const getBlock = vi.fn().mockRejectedValue(new Error('rpc unreachable'));
    const readContract = vi.fn();
    const client: AaveV4RpcClient = {
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
      getBlock: getBlock as unknown as AaveV4RpcClient['getBlock'],
    };
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('propagates a single-field RPC failure (e.g. getUserDebt) as the adapter error, not a partial snapshot', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'getUserDebt') throw new Error('reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };
    const result = await fetchAaveV4DebtSnapshot(failingClient, 'USDC', USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails closed with AAVE_V4_RESERVE_NOT_FOUND when no candidate Hub lists the asset (all getAssetId calls decode as AssetNotListed)', async () => {
    const { client, readContract } = buildClient({
      assetIdListedOnHub: '0x000000000000000000000000000000000000ff',
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
    const getAssetIdCalls = readContract.mock.calls.filter(
      ([a]) => a.functionName === 'getAssetId',
    );
    // All 4 known Hub candidates must have been probed, not just the first.
    expect(getAssetIdCalls.length).toBe(4);
  });
});

describe('fetchAaveV4DebtSnapshot — Hub discovery: "not found" vs. genuine RPC/contract failure (Stage 3 hardening review items 1/6)', () => {
  it('a timeout on the FIRST Hub candidate aborts the probe immediately, without silently trying the remaining 3 Hubs', async () => {
    const { client, readContract } = buildClient({
      assetIdListedOnHub: '0x000000000000000000000000000000000000ff', // no Hub actually matches
      assetIdFailureForOtherHubs: () => timeoutError(),
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RPC_TIMEOUT');
    expect(result.error.code).not.toBe('AAVE_V4_RESERVE_NOT_FOUND');
    const getAssetIdCalls = readContract.mock.calls.filter(
      ([a]) => a.functionName === 'getAssetId',
    );
    // Must NOT have probed all 4 candidates — the timeout on Hub #1 stops discovery there.
    expect(getAssetIdCalls.length).toBe(1);
  });

  it('a network error while probing a Hub aborts the probe immediately, never reinterpreted as "not found"', async () => {
    const { client } = buildClient({
      assetIdListedOnHub: '0x000000000000000000000000000000000000ff',
      assetIdFailureForOtherHubs: () => networkError(),
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RPC_NETWORK_ERROR');
    expect(result.error.retryable).toBe(true);
  });

  it('a genuine but DIFFERENT contract revert (not AssetNotListed/ReserveNotListed) aborts the probe rather than being treated as absence', async () => {
    const { client, readContract } = buildClient({
      assetIdListedOnHub: '0x000000000000000000000000000000000000ff',
      assetIdFailureForOtherHubs: () => genericRevertError(),
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RPC_CONTRACT_ERROR');
    expect(result.error.code).not.toBe('AAVE_V4_RESERVE_NOT_FOUND');
    const getAssetIdCalls = readContract.mock.calls.filter(
      ([a]) => a.functionName === 'getAssetId',
    );
    expect(getAssetIdCalls.length).toBe(1);
  });

  it('a ReserveNotListed revert from getReserveId (asset listed on the Hub, but Spoke has no reserve for it) continues to the next Hub candidate', async () => {
    // CORE_HUB "lists" the asset (getAssetId succeeds) but the Spoke has
    // no reserve wired to it there; PLUS_HUB is the one that actually
    // resolves. Exercises the getAssetId-succeeds/getReserveId-fails path
    // specifically, distinct from the getAssetId-fails path above.
    let assetIdCallCount = 0;
    const readContract = vi.fn().mockImplementation(async ({ functionName, args }) => {
      if (functionName === 'getAssetId') {
        assetIdCallCount += 1;
        return 7n; // "listed" on every Hub probed
      }
      if (functionName === 'getReserveId') {
        const hubArg = args[0] as string;
        if (hubArg.toLowerCase() === AAVE_V4_ETHEREUM_HUBS.PLUS.toLowerCase()) {
          return 42n;
        }
        throw notListedError('ReserveNotListed');
      }
      if (functionName === 'getReserve') {
        return {
          underlying: '0x0000000000000000000000000000000000d00d',
          hub: AAVE_V4_ETHEREUM_HUBS.PLUS,
          assetId: 7,
          decimals: 6,
          collateralRisk: 500,
          flags: 0,
          dynamicConfigKey: 0,
        };
      }
      if (functionName === 'getUserDebt') return [20_000_000_000n, 0n];
      if (functionName === 'getAssetDrawnRate') return 50_000_000_000_000_000_000_000_000n;
      if (functionName === 'getUserLastRiskPremium') return 0n;
      if (functionName === 'getUserReserveStatus') return [true, true];
      if (functionName === 'ORACLE') return DEFAULT_ORACLE;
      if (functionName === 'decimals') return 6;
      if (functionName === 'getReservePrice') return 99_980_000n; // $0.9998 at 8 decimals
      throw new Error(`Unexpected functionName in test: ${functionName}`);
    });
    const getBlock = vi.fn().mockResolvedValue({ number: 21_000_000n, timestamp: 1_700_000_000n });
    const client: AaveV4RpcClient = {
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
      getBlock: getBlock as unknown as AaveV4RpcClient['getBlock'],
    };

    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.display.hub.toLowerCase()).toBe(AAVE_V4_ETHEREUM_HUBS.PLUS.toLowerCase());
    // CORE was tried and rejected (via ReserveNotListed) before PLUS succeeded.
    expect(assetIdCallCount).toBe(2);
  });
});

describe('fetchAaveV4DebtSnapshot — decimals mismatch', () => {
  it('fails closed with AAVE_V4_DECIMALS_MISMATCH when the on-chain reserve decimals disagree with the hardcoded registry', async () => {
    const { client } = buildClient({ reserveDecimals: 18 });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_DECIMALS_MISMATCH');
    expect(result.error.retryable).toBe(false);
  });

  it('fails closed with AAVE_V4_DECIMALS_MISMATCH when the live ERC20 decimals disagree with the hardcoded registry', async () => {
    const { client } = buildClient({ liveDecimals: 18 });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_DECIMALS_MISMATCH');
  });
});

describe('fetchAaveV4DebtSnapshot — missing position state', () => {
  it('fails closed with AAVE_V4_NO_BORROW_POSITION when the user has never borrowed this reserve, rather than returning a zero-debt snapshot', async () => {
    const { client } = buildClient({ borrowed: false, drawnDebtRaw: 0n, premiumDebtRaw: 0n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_NO_BORROW_POSITION');
    expect('data' in result).toBe(false);
  });
});

describe('fetchAaveV4DebtSnapshot — effective risk-premium derivation', () => {
  it("maps getUserLastRiskPremium (BPS) directly to the engine's riskPremium fraction, without recomputing it", async () => {
    const { client, readContract } = buildClient({ riskPremiumBps: 2500n }); // 25%
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.engineInputs.riskPremium).toBeCloseTo(0.25, 6);

    // Confirms the source is getUserLastRiskPremium, not getUserAccountData
    // or any collateral-derived recomputation — see the Stage 2 review's
    // riskPremium contract.
    const riskPremiumCalls = readContract.mock.calls.filter(
      ([a]) => a.functionName === 'getUserLastRiskPremium',
    );
    expect(riskPremiumCalls.length).toBe(1);
    expect(riskPremiumCalls[0][0].args).toEqual([USER]);
  });

  it('supports a zero risk premium (pristine collateral) without special-casing it', async () => {
    const { client } = buildClient({ riskPremiumBps: 0n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.engineInputs.riskPremium).toBe(0);
  });

  it('supports a Risk Premium above 100% (docs/overview.md states Collateral Risk can reach 1000%)', async () => {
    const { client } = buildClient({ riskPremiumBps: 100_000n }); // 1000%
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.engineInputs.riskPremium).toBeCloseTo(10.0, 6);
  });
});

describe('fetchAaveV4DebtSnapshot — block timestamp handling (Stage 3 hardening review item 4)', () => {
  it('includes a block timestamp that corresponds to the same pinned block as blockNumber (fetched together via getBlock)', async () => {
    const { client, getBlock } = buildClient({
      blockNumber: 21_500_000n,
      blockTimestamp: 1_710_000_000n,
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(result.data.raw.blockNumber).toBe(21_500_000n);
    expect(result.data.raw.blockTimestamp).toBe(1_710_000_000n);
    expect(result.data.display.blockTimestamp).toBe(new Date(1_710_000_000 * 1000).toISOString());
  });

  it('does not read or depend on any per-user timestamp — ISpoke.UserPosition has none (drawnShares/premiumShares/premiumOffsetRay/suppliedShares/dynamicConfigKey only); only the block-level timestamp is used', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);

    const calledFunctionNames = new Set(readContract.mock.calls.map(([a]) => a.functionName));
    for (const name of calledFunctionNames) {
      expect(name.toLowerCase()).not.toContain('timestamp');
    }
  });

  it('engineInputs never includes elapsedDays — projecting forward from this snapshot always requires the caller to supply it separately', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('elapsedDays' in result.data.engineInputs).toBe(false);
  });

  it('stringifies blockNumber and ISO-formats blockTimestamp for JSON-safety (bigint does not survive JSON.stringify)', async () => {
    const { client } = buildClient({ blockNumber: 19_999_999n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data.display.blockNumber).toBe('string');
    expect(typeof result.data.display.blockTimestamp).toBe('string');
    expect(() => JSON.stringify(result.data.display)).not.toThrow();
  });
});

/**
 * V4 Readiness Audit §12 P1-D1 — the debt-asset oracle price boundary.
 * Mirrors `collateralRiskSnapshot.test.ts`'s own P1-B oracle-boundary
 * suite. Deliberately non-$1 prices throughout (0.9973, 1.0041) so an
 * accidental fixed-`1` implementation cannot pass. This stage only
 * ESTABLISHES `debtAssetPriceUsd` — nothing consumes it yet, so these
 * tests check the field directly, never `engineInputs`/HF/etc.
 */
describe('fetchAaveV4DebtSnapshot — debt oracle price boundary (P1-D1)', () => {
  it('reuses the exact DEBT reserveId already resolved for getUserDebt/getReserve/etc. when calling getReservePrice', async () => {
    const { client, readContract } = buildClient({ reserveId: 77n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);

    const getReservePriceCall = readContract.mock.calls.find(
      ([a]) => a.functionName === 'getReservePrice',
    );
    expect(getReservePriceCall?.[0].args).toEqual([77n]);
    if (result.ok) expect(result.data.raw.reserveId).toBe(77n);
  });

  it('returns the correct, non-$1 normalized debt-asset price for USDC', async () => {
    const { client } = buildClient({
      debtAssetPriceRaw: 99_730_000n, // $0.9973 at 8 decimals
      oracleDecimals: 8,
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtAssetPriceUsd).toBeCloseTo(0.9973, 8);
  });

  it('USDC and USDT can produce deliberately different oracle prices — proves no shared/hardcoded value', async () => {
    const { client: usdcClient } = buildClient({ debtAssetPriceRaw: 99_730_000n }); // $0.9973
    const usdcResult = await fetchAaveV4DebtSnapshot(usdcClient, 'USDC', USER);
    expect(usdcResult.ok).toBe(true);
    if (!usdcResult.ok) return;
    expect(usdcResult.data.debtAssetPriceUsd).toBeCloseTo(0.9973, 8);

    const { client: usdtClient } = buildClient({ debtAssetPriceRaw: 100_410_000n }); // $1.0041
    const usdtResult = await fetchAaveV4DebtSnapshot(usdtClient, 'USDT', USER);
    expect(usdtResult.ok).toBe(true);
    if (!usdtResult.ok) return;
    expect(usdtResult.data.debtAssetPriceUsd).toBeCloseTo(1.0041, 8);

    expect(usdcResult.data.debtAssetPriceUsd).not.toBe(usdtResult.data.debtAssetPriceUsd);
  });

  it('reads oracle decimals live rather than assuming a fixed precision', async () => {
    const { client, readContract } = buildClient({ oracleDecimals: 18 });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.raw.debtAssetPriceDecimals).toBe(18);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: DEFAULT_ORACLE, functionName: 'decimals' }),
    );
  });

  it('normalizes correctly at 18-decimal precision (not just the reference 8-decimal default)', async () => {
    const { client } = buildClient({
      oracleDecimals: 18,
      debtAssetPriceRaw: 997_300_000_000_000_000n, // $0.9973 at 18 decimals
    });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtAssetPriceUsd).toBeCloseTo(0.9973, 8);
  });

  it('normalizes correctly at 6-decimal precision too', async () => {
    const { client } = buildClient({ oracleDecimals: 6, debtAssetPriceRaw: 997_300n }); // $0.9973
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtAssetPriceUsd).toBeCloseTo(0.9973, 8);
  });

  it('rejects a zero raw oracle price with AAVE_V4_INVALID_ORACLE_PRICE rather than fabricating a value', async () => {
    const { client } = buildClient({ debtAssetPriceRaw: 0n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_INVALID_ORACLE_PRICE');
  });

  it('rejects a non-finite normalized price (decimals large enough to overflow 10**decimals) with AAVE_V4_INVALID_ORACLE_PRICE', async () => {
    const { client } = buildClient({ oracleDecimals: 400, debtAssetPriceRaw: 1n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_INVALID_ORACLE_PRICE');
  });

  it('fails closed, with no fabricated price, when ORACLE() (oracle discovery) fails', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'ORACLE') throw new Error('reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4DebtSnapshot(failingClient, 'USDC', USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails closed, with no fabricated price, when the oracle decimals() read fails', async () => {
    const { client } = buildClient();
    let oracleDecimalsCallSeen = false;
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string; address: string }) => {
        if (
          params.functionName === 'decimals' &&
          String(params.address).toLowerCase() === DEFAULT_ORACLE.toLowerCase()
        ) {
          oracleDecimalsCallSeen = true;
          throw new Error('reverted');
        }
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4DebtSnapshot(failingClient, 'USDC', USER);
    expect(result.ok).toBe(false);
    expect(oracleDecimalsCallSeen).toBe(true);
  });

  it('fails closed, with no fabricated price, when getReservePrice() fails (e.g. AaveOracle.InvalidPrice for a non-positive feed answer)', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'getReservePrice') throw new Error('InvalidPrice reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4DebtSnapshot(failingClient, 'USDC', USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('never uses a collateral reserveId for the debt price — this adapter path never resolves a collateral reserve at all', async () => {
    const { client, readContract } = buildClient({ reserveId: 55n });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(true);

    // Every reserveId-scoped call in this entire fetch used the same,
    // single (debt) reserveId — there is no second reserve resolution
    // anywhere in this function.
    for (const call of readContract.mock.calls) {
      const args = call[0].args as unknown[] | undefined;
      if (call[0].functionName === 'getReservePrice' || call[0].functionName === 'getUserDebt') {
        expect(args?.[0]).toBe(55n);
      }
    }
  });

  it('AAVE_V4_NO_BORROW_POSITION remains the last possible failure — a valid oracle price is still resolved even for a non-borrowing address before that check runs', async () => {
    const { client, readContract } = buildClient({ borrowed: false });
    const result = await fetchAaveV4DebtSnapshot(client, 'USDC', USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_NO_BORROW_POSITION');
    // The oracle price read still happened before the borrowed check
    // rejected the request — proving oracle discovery/price/decimals
    // cannot become a NEW failure mode reachable only after this one.
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getReservePrice' }),
    );
  });
});

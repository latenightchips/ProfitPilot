/**
 * Automated Aave V4 wire-boundary verification — V4 Readiness Audit §12
 * P0-3. Closes the audit finding: `scripts/verifyAaveV4Snapshot.ts`
 * (Stage 3) is the only code path that exercises the real V4 ABI/
 * address/decimals boundary, but it requires `AAVE_V4_USER_ADDRESS` — a
 * wallet with a REAL, currently-active borrow position — and is
 * documented as "run it manually," never wired into CI. Every unit/
 * integration test mocks the RPC/client boundary
 * (`infrastructure/protocols/aave/v4/client.ts`'s `AaveV4RpcClient` is
 * always faked), so a real contract-address error, ABI mismatch,
 * decimals drift, or deployment change could pass the entire `pnpm
 * validate` suite and only surface for a real user.
 *
 * **Deliberately a NEW, separate script — `verifyAaveV4Snapshot.ts` is
 * NOT rewritten.** That script's whole point is a human, interactively,
 * pointing it at their OWN wallet to eyeball a real projection — a
 * different job from "does the deployment/ABI/config boundary still
 * match what this repo assumes," which needs to run unattended, on a
 * schedule, with no wallet at all. Reusing the same real adapter
 * functions (`fetchAaveV4DebtSnapshot`/`fetchAaveV4CollateralRiskSnapshot`,
 * `infrastructure/protocols/aave/v4`) both scripts already depend on
 * keeps this from becoming a second, drift-prone reimplementation of the
 * read path.
 *
 * **No real position required — the "no borrow position" outcome IS the
 * pass signal.** `fetchAaveV4DebtSnapshot`'s own check order (see that
 * file's header comment) resolves the Hub/Spoke reserve, reads the
 * reserve config, the user's debt/rate/risk-premium/reserve-status, and
 * the live ERC20 decimals — ALL via real, ABI-decoded contract reads —
 * BEFORE it ever inspects `borrowed`. Reaching `AAVE_V4_NO_BORROW_POSITION`
 * therefore already proves RPC connectivity, contract addresses, ABI
 * compatibility, reserve resolution, and decimals all still match — the
 * ONLY reason for that specific "failure" is that the probed address
 * legitimately has no debt, which is expected and correct for an
 * arbitrary address. This script probes the EVM zero address
 * (`0x0000...0000`) — not a real or borrowed wallet, and not a "stable
 * public fixture" whose behavior could drift over time (nobody can ever
 * open a real position from it) — so `ok: true` OR
 * `error.code === 'AAVE_V4_NO_BORROW_POSITION'` both count as the debt
 * boundary check PASSING; any OTHER code is real, reportable drift.
 *
 * **Collateral-risk has no equivalent "no position" branch, and its
 * final read carries a genuine, UNRESOLVED uncertainty — deliberately
 * NOT papered over.** `fetchAaveV4CollateralRiskSnapshot` does two
 * reads: `getUserPosition(reserveId, user)` (a plain mapping read — for
 * ANY address, including one that has never touched the protocol,
 * Solidity mapping semantics guarantee this returns the type's
 * zero-value struct rather than reverting, so this step is exactly as
 * deterministic as the debt-boundary check's own reserve-resolution
 * reads: reaching it at all already proves Hub/Spoke address, `getAssetId`/
 * `getReserveId` ABI compatibility, and reserve resolution for the WBTC
 * collateral asset specifically), then
 * `getDynamicReserveConfig(reserveId, dynamicConfigKey)` keyed by
 * WHATEVER `dynamicConfigKey` that first read returned — for the zero
 * address, almost certainly `0` (Solidity's default `uint32`). **Whether
 * `getDynamicReserveConfig(reserveId, 0)` itself reverts or returns a
 * real zero-value config for an address with no bound key depends on
 * whether the underlying Solidity storage for dynamic configs is a
 * `mapping` (never reverts) or an `array`/similarly bounds-checked
 * structure (reverts on an unset/out-of-range index) — this repo has no
 * access to the actual `aave-v4` Solidity source to confirm which, and
 * no live RPC access was available while writing this check to observe
 * it empirically either.** Given that unresolved uncertainty, this
 * script does NOT assume `ok: true` is the only valid outcome the way
 * it can for the debt boundary's `AAVE_V4_NO_BORROW_POSITION`. Instead:
 * `ok: true` still passes (strongest signal); any error code that is
 * unambiguously address-independent (timeout, network error, reserve
 * not found, unknown error) still fails outright, full confidence; but
 * `AAVE_V4_RPC_CONTRACT_ERROR` specifically — the one code a genuine
 * "index 0 not set" revert would also produce — is reported as an
 * EXPLICIT, distinctly-worded FAILURE noting the interpretive ambiguity,
 * never silently folded into PASS. Reporting an honestly-uncertain case
 * as a failure requiring human review is the conservative, correct
 * choice for a verification tool — a false-positive PASS here would
 * hide real drift; a false-positive FAIL merely costs one manual look.
 *
 * **Normalization/shape check** reuses the EXACT existing Zod schemas
 * every other manual/live `v4DebtState`/`v4CollateralRisk` write in this
 * app is already validated against (`types/portfolio.schema.ts`'s
 * `aaveV4DebtStateSchema`/`aaveV4CollateralRiskConfigSchema`) — not a
 * second, parallel shape assertion invented for this script alone. A
 * successful RPC read whose mapped `engineInputs`/`canonical` fails
 * THIS check would mean the normalization layer itself has drifted,
 * independent of whether the RPC calls succeeded.
 *
 * **Error classification is reused, never reinvented.** Every failure
 * this script reports carries the SAME `AAVE_V4_*` code the real
 * adapter/route layer already produces (`AAVE_V4_RPC_TIMEOUT`,
 * `AAVE_V4_RPC_NETWORK_ERROR`, `AAVE_V4_RPC_CONTRACT_ERROR`,
 * `AAVE_V4_RESERVE_NOT_FOUND`, `AAVE_V4_DECIMALS_MISMATCH`, etc. — see
 * `infrastructure/protocols/aave/v4/client.ts`'s `classifyError`) plus
 * two check-local labels for conditions the adapter has no code for at
 * all: `WRONG_CHAIN_ID` (the configured RPC answered with a chain ID
 * other than mainnet's `1`) and `SHAPE_MISMATCH` (a successful read
 * whose normalized output fails the reused Zod schema).
 *
 * Env vars (no secrets are hardcoded anywhere in this file):
 *   AAVE_V4_RPC_URL   Optional AT THE SCRIPT LEVEL. If unset, this
 *                      script falls back to the exact same public
 *                      default `infrastructure/protocols/aave/v4/addresses.ts`
 *                      already uses in production
 *                      (`AAVE_V4_DEFAULT_RPC_URL`) — useful for a local,
 *                      manual `pnpm verify:aave-v4-boundary` run with no
 *                      configuration at all. This script always makes a
 *                      real RPC attempt against a real endpoint either
 *                      way; it never silently no-ops because the
 *                      variable is absent.
 *
 *                      The SCHEDULED CI WORKFLOW
 *                      (`.github/workflows/aave-v4-boundary.yml`) makes
 *                      this REQUIRED, one layer above this script — see
 *                      that file's own header comment for why: a free
 *                      public endpoint's rate limits are fine for an
 *                      occasional manual check but would make a daily
 *                      unattended job's own failures untrustworthy noise
 *                      ("did this fail because of drift, or because of
 *                      rate-limiting?"). The workflow fails immediately,
 *                      before ever invoking this script, if the secret
 *                      is not configured — it does not rely on this
 *                      script's own local-fallback behavior to catch
 *                      that case.
 */
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

import {
  type AaveV4CollateralRiskSnapshotResult,
  type AaveV4SnapshotResult,
  fetchAaveV4CollateralRiskSnapshot,
  fetchAaveV4DebtSnapshot,
} from '@/infrastructure/protocols/aave/v4';
import {
  AAVE_V4_DEFAULT_RPC_URL,
  AAVE_V4_ETHEREUM_DEBT_ASSETS,
} from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import { aaveV4CollateralRiskConfigSchema, aaveV4DebtStateSchema } from '@/types/portfolio.schema';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const EXPECTED_CHAIN_ID = mainnet.id;
const TIMEOUT_MS = 10_000;

export interface CheckResult {
  name: string;
  ok: boolean;
  code: string;
  detail: string;
}

function pass(name: string, detail: string): CheckResult {
  return { name, ok: true, code: 'OK', detail };
}

function fail(name: string, code: string, detail: string): CheckResult {
  return { name, ok: false, code, detail };
}

/**
 * Pure classification of an already-obtained `fetchAaveV4DebtSnapshot`
 * result — separated from `checkDebtBoundary`'s own RPC call so this
 * decision (including the "NO_BORROW_POSITION counts as PASS" rule and
 * the reused-schema shape check) is unit-testable with plain fixture
 * objects, no network access required. See this file's own header
 * comment for the full reasoning.
 */
export function classifyDebtBoundaryResult(
  debtAssetSymbol: string,
  result: AaveV4SnapshotResult,
): CheckResult {
  const name = `Debt boundary (${debtAssetSymbol})`;

  if (!result.ok) {
    if (result.error.code === 'AAVE_V4_NO_BORROW_POSITION') {
      return pass(
        name,
        'RPC/ABI/reserve/decimals boundary all confirmed working — the zero address correctly ' +
          'has no borrow position (the expected outcome, not a failure).',
      );
    }
    return fail(name, result.error.code, result.error.message);
  }

  const shapeCheck = aaveV4DebtStateSchema.safeParse(result.data.engineInputs);
  if (!shapeCheck.success) {
    return fail(
      name,
      'SHAPE_MISMATCH',
      `A live read succeeded but engineInputs failed normalization: ${shapeCheck.error.message}`,
    );
  }
  return pass(
    name,
    `A live position was unexpectedly found and normalized correctly (drawnDebt=${result.data.engineInputs.drawnDebt}).`,
  );
}

/**
 * Same role as `classifyDebtBoundaryResult` above, for
 * `fetchAaveV4CollateralRiskSnapshot`'s result — see this file's own
 * header comment for why `AAVE_V4_RPC_CONTRACT_ERROR` specifically gets
 * its own explanatory (still failing) branch rather than being treated
 * either as an automatic pass or an indistinguishable generic failure.
 */
export function classifyCollateralRiskBoundaryResult(
  result: AaveV4CollateralRiskSnapshotResult,
): CheckResult {
  const name = 'Collateral-risk boundary';

  if (!result.ok) {
    if (result.error.code === 'AAVE_V4_RPC_CONTRACT_ERROR') {
      return fail(
        name,
        'AAVE_V4_RPC_CONTRACT_ERROR',
        "A contract call reverted while reading the zero address's collateral-risk config. This " +
          'may indicate real ABI/deployment drift, OR may be an expected revert from probing an ' +
          'address with no bound dynamicConfigKey — this script cannot distinguish the two without ' +
          'Solidity source access or a confirmed real position, so it reports this as a failure ' +
          "requiring human review rather than assuming success. See this file's own header comment.",
      );
    }
    return fail(name, result.error.code, result.error.message);
  }

  const shapeCheck = aaveV4CollateralRiskConfigSchema.safeParse(result.data.canonical);
  if (!shapeCheck.success) {
    return fail(
      name,
      'SHAPE_MISMATCH',
      `A live read succeeded but canonical collateral risk failed normalization: ${shapeCheck.error.message}`,
    );
  }
  return pass(
    name,
    `RPC/ABI/reserve boundary confirmed working (collateralFactor=${result.data.canonical.collateralFactor}).`,
  );
}

/**
 * Reads the RPC endpoint's own reported chain ID via a plain
 * `PublicClient` (not the narrowed `AaveV4RpcClient` the production
 * adapter uses, which deliberately exposes only `readContract`/
 * `getBlock` — this check has no reason to touch that narrowing).
 */
async function checkChainId(rpcUrl: string): Promise<CheckResult> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: TIMEOUT_MS }),
    });
    const chainId = await client.getChainId();
    if (chainId !== EXPECTED_CHAIN_ID) {
      return fail(
        'Chain ID',
        'WRONG_CHAIN_ID',
        `RPC endpoint reported chain ID ${chainId}, expected Ethereum mainnet (${EXPECTED_CHAIN_ID}).`,
      );
    }
    return pass('Chain ID', `Confirmed Ethereum mainnet (chain ID ${chainId}).`);
  } catch (error) {
    return fail(
      'Chain ID',
      'AAVE_V4_RPC_NETWORK_ERROR',
      `Could not read chain ID from the configured RPC endpoint: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function checkDebtBoundary(
  client: ReturnType<typeof createAaveV4RpcClient>,
  debtAssetSymbol: string,
): Promise<CheckResult> {
  const result = await fetchAaveV4DebtSnapshot(client, debtAssetSymbol, ZERO_ADDRESS);
  return classifyDebtBoundaryResult(debtAssetSymbol, result);
}

async function checkCollateralRiskBoundary(
  client: ReturnType<typeof createAaveV4RpcClient>,
): Promise<CheckResult> {
  const result = await fetchAaveV4CollateralRiskSnapshot(client, ZERO_ADDRESS);
  return classifyCollateralRiskBoundaryResult(result);
}

async function main(): Promise<void> {
  const rpcUrl = process.env.AAVE_V4_RPC_URL ?? AAVE_V4_DEFAULT_RPC_URL;
  const usingDefault =
    process.env.AAVE_V4_RPC_URL === undefined || process.env.AAVE_V4_RPC_URL === '';

  console.log('=== Aave V4 wire-boundary verification (P0-3) ===');
  console.log(
    usingDefault
      ? 'AAVE_V4_RPC_URL not set — using the same public default the app itself falls back to.'
      : 'Using AAVE_V4_RPC_URL from the environment.',
  );
  console.log('');

  const client = createAaveV4RpcClient(rpcUrl);

  const results: CheckResult[] = [];
  results.push(await checkChainId(rpcUrl));
  for (const debtAssetSymbol of Object.keys(AAVE_V4_ETHEREUM_DEBT_ASSETS)) {
    results.push(await checkDebtBoundary(client, debtAssetSymbol));
  }
  results.push(await checkCollateralRiskBoundary(client));

  let anyFailed = false;
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} — ${result.name}`);
    console.log(`  code:   ${result.code}`);
    console.log(`  detail: ${result.detail}`);
    console.log('');
    if (!result.ok) anyFailed = true;
  }

  if (anyFailed) {
    console.error('One or more Aave V4 wire-boundary checks failed — see FAIL entries above.');
    process.exitCode = 1;
    return;
  }
  console.log('All Aave V4 wire-boundary checks passed.');
}

/**
 * Only run `main()` (real RPC calls) when this file is executed
 * directly (`pnpm verify:aave-v4-boundary` / `tsx scripts/verifyAaveV4Boundary.ts`)
 * — never merely because something IMPORTS this module. Without this
 * guard, `tests/unit/scripts/verifyAaveV4Boundary.test.ts` importing the
 * pure `classifyDebtBoundaryResult`/`classifyCollateralRiskBoundaryResult`
 * exports below would also trigger a real, unmocked network attempt on
 * every test run.
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('Unhandled error running the Aave V4 wire-boundary verification:', error);
    process.exitCode = 1;
  });
}

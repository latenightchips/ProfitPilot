/**
 * Standalone live-mainnet verification tool — Stage 3 (V4 Readiness Audit
 * §12), item 14. NOT wired into the app (no route, no build entry, no
 * import from `app/`/`services/`/`stores/` references this file) — run it
 * manually, from a shell, against a real Ethereum RPC endpoint.
 *
 * Pins one block, fetches the raw Aave V4 state for one
 * user/collateral/debt-asset combination via the Stage 3 read-only
 * adapter, prints the raw values, derives the Stage 2 Engine's
 * `AaveV4DebtProjectionInput` via the same pure mapper the adapter uses,
 * runs `projectAaveV4Debt` — the actual Stage 2 Engine implementation,
 * not a reimplementation — and prints the projection.
 *
 * Usage:
 *   AAVE_V4_USER_ADDRESS=0x... npx tsx scripts/verifyAaveV4Snapshot.ts [debtAssetSymbol] [elapsedDays] [blockNumber]
 *
 * **Why `npx tsx` (Stage 3 hardening review item 7)**: this script imports
 * `@/engine/...` and `@/infrastructure/...` — the same `@/*` tsconfig
 * path alias every other file in this repo uses — and those files
 * themselves use extensionless relative imports throughout (e.g.
 * `engine/protocols/aaveV4/projectAaveV4Debt.ts` imports `from
 * '../../shared/decimal'`, no `.ts`). Plain `node
 * --experimental-strip-types` (available on this repo's Node 22, no new
 * dependency) only strips type annotations — it does not resolve
 * tsconfig `paths` aliases, and Node's own ESM resolver requires explicit
 * file extensions on every relative specifier, so it fails immediately on
 * this repo's existing, untouched import style (confirmed by hand before
 * choosing `tsx`). Fixing that would mean rewriting import statements
 * across `engine/`/`infrastructure/` repo-wide — far more invasive than
 * one devDependency, and out of scope for a Stage 3 read-only adapter.
 * `vite-node` (vitest's own runner, which DOES already handle both
 * concerns) has no standalone CLI binary exposed in this install without
 * itself becoming an equivalent added dependency. `tsx` is a single,
 * minimal, zero-config, purpose-built tool for exactly this case — kept
 * as a devDependency rather than removed.
 *
 * Env vars (no secrets are hardcoded anywhere in this file):
 *   AAVE_V4_USER_ADDRESS   Required. The on-chain address to read a V4 position for.
 *   AAVE_V4_RPC_URL        Optional. Defaults to the same public endpoint
 *                          `infrastructure/protocols/aave/v4/addresses.ts` already uses
 *                          (`AAVE_V4_DEFAULT_RPC_URL`) — a free-tier public RPC has rate
 *                          limits; set this to your own RPC provider's URL for reliable use.
 *
 * Positional args (all optional):
 *   debtAssetSymbol   'USDC' (default) or 'USDT'.
 *   elapsedDays        Projection horizon in days, default 30.
 *   blockNumber         Pin to a specific historical block instead of "latest".
 */
import { projectAaveV4Debt } from '@/engine/protocols/aaveV4';
import { AAVE_V4_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import { fetchAaveV4DebtSnapshot } from '@/infrastructure/protocols/aave/v4/index';

async function main(): Promise<void> {
  const userAddress = process.env.AAVE_V4_USER_ADDRESS;
  if (userAddress === undefined || !/^0x[0-9a-fA-F]{40}$/.test(userAddress)) {
    console.error(
      'AAVE_V4_USER_ADDRESS environment variable must be set to a valid 0x-prefixed Ethereum address.',
    );
    process.exitCode = 1;
    return;
  }

  const debtAssetSymbol = process.argv[2] ?? 'USDC';
  const elapsedDays = Number(process.argv[3] ?? '30');
  const pinnedBlock = process.argv[4] !== undefined ? BigInt(process.argv[4]) : undefined;

  const rpcUrl = process.env.AAVE_V4_RPC_URL ?? AAVE_V4_DEFAULT_RPC_URL;
  const client = createAaveV4RpcClient(rpcUrl);

  console.log('=== Aave V4 live verification ===');
  console.log(`RPC endpoint:     ${rpcUrl}`);
  console.log(`User address:     ${userAddress}`);
  console.log(`Debt asset:       ${debtAssetSymbol}`);
  console.log(`Elapsed days:     ${elapsedDays}`);
  console.log(
    `Block:            ${pinnedBlock !== undefined ? pinnedBlock.toString() : 'latest (fetched fresh)'}`,
  );
  console.log('');

  const result = await fetchAaveV4DebtSnapshot(
    client,
    debtAssetSymbol,
    userAddress as `0x${string}`,
    pinnedBlock,
  );

  if (!result.ok) {
    console.error('Snapshot fetch FAILED:');
    console.error(`  code:         ${result.error.code}`);
    console.error(`  message:      ${result.error.message}`);
    console.error(`  retryable:    ${result.error.retryable}`);
    process.exitCode = 1;
    return;
  }

  const { raw, engineInputs, display } = result.data;

  console.log('--- Raw V4 state (layer 1) ---');
  console.log(`Block number:            ${raw.blockNumber.toString()}`);
  console.log(
    `Block timestamp:         ${raw.blockTimestamp.toString()} (${display.blockTimestamp})`,
  );
  console.log(`Hub:                     ${raw.hub}`);
  console.log(`Spoke:                   ${raw.spoke}`);
  console.log(`Asset ID:                ${raw.assetId.toString()}`);
  console.log(`Reserve ID:              ${raw.reserveId.toString()}`);
  console.log(`Reserve decimals:        ${raw.reserve.decimals}`);
  console.log(`Reserve collateralRisk:  ${raw.reserve.collateralRisk} BPS`);
  console.log(`Raw drawnDebt:           ${raw.userDebt.drawnDebt.toString()} (asset units)`);
  console.log(`Raw premiumDebt:         ${raw.userDebt.premiumDebt.toString()} (asset units)`);
  console.log(`Raw drawnRateRay:        ${raw.drawnRateRay.toString()} (RAY)`);
  console.log(`Raw userLastRiskPremium: ${raw.userLastRiskPremiumBps.toString()} BPS`);
  console.log(`usingAsCollateral:       ${raw.userReserveStatus.usingAsCollateral}`);
  console.log(`borrowed:                ${raw.userReserveStatus.borrowed}`);
  console.log(`Live ERC20 decimals:     ${raw.liveDecimals}`);
  console.log('');

  console.log('--- Derived Stage 2 Engine inputs (layer 2) ---');
  console.log(`drawnDebt:    ${engineInputs.drawnDebt}`);
  console.log(`premiumDebt:  ${engineInputs.premiumDebt}`);
  console.log(`baseDrawnApr: ${engineInputs.baseDrawnApr}`);
  console.log(`riskPremium:  ${engineInputs.riskPremium}`);
  console.log('');

  console.log('--- Display metadata (layer 3) ---');
  console.log(display);
  console.log('');

  const projection = projectAaveV4Debt({ ...engineInputs, elapsedDays });

  console.log(`--- projectAaveV4Debt(elapsedDays=${elapsedDays}) ---`);
  if (!projection.ok) {
    console.error('Projection FAILED:');
    console.error(`  code:    ${projection.error.code}`);
    console.error(`  message: ${projection.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Projected drawnDebt:   ${projection.value.drawnDebt}`);
  console.log(`Projected premiumDebt: ${projection.value.premiumDebt}`);
  console.log(`Projected totalDebt:   ${projection.value.totalDebt}`);
  console.log(`Formula ID:            ${projection.metadata.formulaId}`);
  console.log(`Formula version:       ${projection.metadata.formulaVersion}`);
}

main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exitCode = 1;
});

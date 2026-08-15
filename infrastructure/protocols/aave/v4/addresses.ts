/**
 * Aave V4 Ethereum Mainnet addresses — Stage 3 (V4 Readiness Audit §12).
 * Verified against `bgd-labs/aave-address-book` (commit
 * `70e2f303fe93616784148d6827df6644e5dda4db`), `src/AaveV4Ethereum.sol` /
 * `src/ts/AaveV4Ethereum.ts` — the same official source already used for
 * V3's addresses (`../v3/addresses.ts`), not from memory. Ethereum mainnet
 * only (Stage 3 scope item 8) — no other chain is represented here.
 *
 * **Hub addresses (`AaveV4EthereumHubs`)**: all 4 documented Hubs, listed
 * for completeness and for the runtime reserve-resolution probe in
 * `./index.ts` (see that file's header comment for why the exact
 * Hub/Spoke/reserve wiring for WBTC/USDC/USDT is resolved at read-time via
 * `getAssetId`/`getReserveId`, not hardcoded as a specific reserveId — the
 * address book publishes contract addresses, not the Hub<->asset<->Spoke
 * reserve graph, which only exists in on-chain storage).
 *
 * **Spoke address**: `MAIN_SPOKE` — the address book's own
 * `AaveV4EthereumGetters.getAllSpokes()` lists 12 lending Spokes (as
 * opposed to the 35 separate `AaveV4EthereumTokenizationSpokes`, an
 * ERC-4626-style wrapped-position product this adapter does not target).
 * `MAIN_SPOKE`'s own price-feed registry
 * (`AaveV4EthereumSpokePriceFeeds.MAIN_SPOKE_WBTC_PRICE_FEED`,
 * `_USDC_PRICE_FEED`, `_USDT_PRICE_FEED`) is the only lending Spoke whose
 * feed set covers all three of ProfitPilot's assets (WBTC collateral,
 * USDC/USDT debt) together — every other lending Spoke (BLUECHIP,
 * ETHENA_CORRELATED/ECOSYSTEM, FOREX, GOLD, LOMBARD_BTC, USDG_PENDLE) is
 * scoped to a different, narrower asset set. This is an INFERENCE from the
 * address book's own price-feed grouping, not a directly-stated
 * "MAIN_SPOKE is ProfitPilot's market" fact — `./index.ts`'s runtime
 * reserve-resolution probe is what actually confirms (or refutes) that
 * `MAIN_SPOKE` has live WBTC/USDC/USDT reserves, by attempting the real
 * on-chain lookup rather than trusting this inference alone.
 */
export const AAVE_V4_ETHEREUM_HUBS = {
  CORE: '0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9',
  PLUS: '0x06002e9c4412CB7814a791eA3666D905871E536A',
  PRIME: '0x943827DCA022D0F354a8a8c332dA1e5Eb9f9F931',
  GLOBAL_DOLLAR: '0x62d63197660c080236193CA60b70E49A08E90368',
} as const;

/**
 * Ordered candidate list for `./index.ts`'s reserve-resolution probe —
 * CORE first, since `AaveV4EthereumIRStrategies`' `CORE_WBTC_IR_STRATEGY`/
 * `CORE_USDC_IR_STRATEGY`/`CORE_USDT_IR_STRATEGY` and
 * `AaveV4EthereumTokenizationSpokes`' `CORE_WBTC_TOKENIZATION_SPOKE`/
 * `CORE_USDC_TOKENIZATION_SPOKE`/`CORE_USDT_TOKENIZATION_SPOKE` both
 * suggest (same inference caveat as above) these three reserves are
 * primarily hosted on `CORE_HUB` — but every Hub is probed in order until
 * one actually resolves, so a wrong guess here only costs extra RPC calls,
 * never a wrong answer (Stage 3 hardening review confirmed the probe
 * distinguishes a genuine "not listed here" revert from an RPC/transport
 * failure — see `./index.ts`'s `resolveV4Reserve`).
 */
export const AAVE_V4_ETHEREUM_HUB_CANDIDATES = [
  AAVE_V4_ETHEREUM_HUBS.CORE,
  AAVE_V4_ETHEREUM_HUBS.PLUS,
  AAVE_V4_ETHEREUM_HUBS.PRIME,
  AAVE_V4_ETHEREUM_HUBS.GLOBAL_DOLLAR,
] as const;

/** `AaveV4EthereumSpokes.MAIN_SPOKE`. */
export const AAVE_V4_ETHEREUM_SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485';

export const AAVE_V4_ETHEREUM_ASSETS = {
  WBTC: {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
  },
  USDC: {
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
} as const;

export const AAVE_V4_ETHEREUM_MARKET = {
  network: 'Ethereum Mainnet',
  collateralAsset: AAVE_V4_ETHEREUM_ASSETS.WBTC,
} as const;

/**
 * Table-driven registry of the debt assets this stage supports — USDC and
 * USDT only (mirrors `../v3/addresses.ts`'s own DAI exclusion reasoning:
 * no live V4 DAI reserve support has been verified). `./index.ts`'s
 * `isSupportedV4DebtAsset` fails closed for any other symbol before any
 * RPC call is attempted.
 */
export const AAVE_V4_ETHEREUM_DEBT_ASSETS = {
  USDC: AAVE_V4_ETHEREUM_ASSETS.USDC,
  USDT: AAVE_V4_ETHEREUM_ASSETS.USDT,
} as const;

export type AaveV4SupportedDebtAssetSymbol = keyof typeof AAVE_V4_ETHEREUM_DEBT_ASSETS;

/** Same default public RPC endpoint already used for the V3 adapter (`../v3/addresses.ts`). */
export const AAVE_V4_DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com';

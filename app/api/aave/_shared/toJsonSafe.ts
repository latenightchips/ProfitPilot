/**
 * V4 API response boundary — bigint-safe JSON conversion.
 *
 * `NextResponse.json()` delegates to the native `Response.json()`, which
 * uses `JSON.stringify()` internally and throws
 * `TypeError: Do not know how to serialize a BigInt` the instant it
 * encounters a `bigint` anywhere in the object graph. V4's snapshot types
 * (`infrastructure/protocols/aave/v4/types.ts`) each carry a `raw` layer
 * with genuine on-chain `bigint` fields (`blockNumber`, `oraclePriceRaw`,
 * etc.) — unlike V3's `AaveAdapterData`, which never carries raw chain
 * values into its response shape at all (its own `blockNumber` is
 * pre-stringified before it ever reaches `AaveSourceMetadata`). V3's
 * route is not affected and must not be touched.
 *
 * This recursively converts every `bigint` to its decimal-string
 * representation (`123n` -> `"123"`) and leaves everything else — every
 * other value, and the shape of the object itself — unchanged. Applied
 * ONLY at the point a V4 route constructs its HTTP response body, never
 * inside `infrastructure/protocols/aave/v4/index.ts`'s fetch/mapper
 * functions themselves: callers that consume those functions directly
 * (Stores, other server code, and their own tests) still receive real
 * `bigint`s, exactly as before. No information is dropped — every raw
 * field survives, just as a string instead of a `bigint`.
 */

export type JsonSafe<T> = T extends bigint
  ? string
  : T extends readonly (infer U)[]
    ? JsonSafe<U>[]
    : T extends object
      ? { [K in keyof T]: JsonSafe<T[K]> }
      : T;

export function toJsonSafe<T>(value: T): JsonSafe<T> {
  if (typeof value === 'bigint') {
    return value.toString() as JsonSafe<T>;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => toJsonSafe(item)) as JsonSafe<T>;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = toJsonSafe(entryValue);
    }
    return result as JsonSafe<T>;
  }
  return value as JsonSafe<T>;
}

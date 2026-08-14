import { z } from 'zod';

/**
 * Runtime validation for the Aave V3 subgraph's response shape.
 * Numeric wire fields are validated as digit-only strings (the
 * subgraph's own uint256/RAY encoding — see `types.ts`), not parsed
 * into numbers here; `scale.ts` owns the actual unit conversion.
 */
const numericString = z.string().regex(/^\d+$/, 'must be a numeric string');

export const rawAaveReserveSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().nonnegative(),
  baseLTVasCollateral: numericString,
  reserveLiquidationThreshold: numericString,
  variableBorrowRate: numericString,
  liquidityRate: numericString,
  lastUpdateTimestamp: z.number().int().nonnegative(),
  price: z.object({
    priceInEth: numericString,
    oracle: z.object({
      usdPriceEth: numericString,
    }),
  }),
});

export const aaveReservesResponseSchema = z.object({
  data: z.object({
    reserves: z.array(rawAaveReserveSchema),
  }),
});

export type ValidatedAaveReservesResponse = z.infer<typeof aaveReservesResponseSchema>;

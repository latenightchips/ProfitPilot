import { z } from 'zod';

/**
 * Validated environment configuration.
 *
 * Version 0.1 ("Manual Mode") must run with no external services configured —
 * see 01_PRD.md REQ-010 ("Manual Mode functions without backend services").
 * Every field is therefore optional or defaulted; nothing throws unless a
 * *provided* value is malformed.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('ProfitPilot'),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().min(1).default('USD'),
  NEXT_PUBLIC_PRICE_API_URL: z.string().url().optional().or(z.literal('')),
  COINGECKO_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
    NEXT_PUBLIC_PRICE_API_URL: process.env.NEXT_PUBLIC_PRICE_API_URL,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export const env = loadEnv();

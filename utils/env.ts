import { z } from 'zod';

/**
 * Validated environment configuration.
 *
 * Version 0.1 ("Manual Mode") must run with no external services configured —
 * see 01_PRD.md REQ-010 ("Manual Mode functions without backend services").
 * Every field is therefore optional or defaulted; nothing throws unless a
 * *provided* value is malformed.
 *
 * **`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (06_TASKS.md
 * M9-030 "Audit Environment Variable Handling") — renamed this batch from
 * the plain `SUPABASE_URL`/`SUPABASE_ANON_KEY` `04_BUILD_GUIDE.md` itself
 * uses.** A genuine, real defect, not a stylistic preference: Next.js only
 * inlines `NEXT_PUBLIC_*`-prefixed variables into the client bundle;
 * every other `process.env.*` reference is stripped and reads as
 * `undefined` in the browser. `services/auth/supabaseClient.ts` is
 * reached from `providers/AuthProvider.tsx` (`'use client'`) and must
 * construct a `SupabaseClient` in the browser (`GoTrueClient`'s
 * `persistSession: true` requires `localStorage`) — under the old,
 * unprefixed names, `checkSupabaseConfig()` would report
 * `configured: false` in every browser context regardless of what a
 * deployer actually set, silently and permanently defeating the dormant
 * Auth capability even once "configured." The anon key is Supabase's own
 * publishable key, explicitly documented as safe to ship to a browser
 * bundle (`supabaseClient.ts`'s own header comment) — the `NEXT_PUBLIC_`
 * prefix is the correct, not merely convenient, fix. Recorded as a
 * mechanical deviation from the spec's literal variable names in
 * `PROJECT_STATUS.md`'s "Deviations from a literal reading of the docs"
 * section — this environment has neither variable set either way, so the
 * rename has zero behavioral effect here; it corrects behavior for a
 * future real deployment.
 *
 * **`NEXT_PUBLIC_SENTRY_DSN` (06_TASKS.md M9-049 "Implement Production
 * Error Monitoring") — `NEXT_PUBLIC_`-prefixed from the start, not a
 * found-and-fixed defect like the Supabase rename above** (nothing read
 * this variable before this batch, so there was no prior broken behavior
 * to correct — this is simply building it correctly the first time,
 * following the identical reasoning). A Sentry DSN is a write-only
 * ingestion-endpoint identifier, explicitly documented by Sentry itself
 * as safe to ship in client-side code (the same "public token" category
 * as Supabase's anon key, unlike `COINGECKO_API_KEY` below, which is a
 * real secret and deliberately NOT `NEXT_PUBLIC_`-prefixed) — and this
 * application's error monitoring is initialized from
 * `instrumentation-client.ts`, which runs in the browser and therefore
 * needs the same client-bundle inlining every other `NEXT_PUBLIC_*`
 * variable here relies on.
 *
 * **`AAVE_RPC_URL` (direct-RPC Aave V3 adapter, supersedes the earlier
 * Graph-subgraph-based `THEGRAPH_API_KEY`) — server-side only (no
 * `NEXT_PUBLIC_` prefix): an RPC URL is not inherently safe to ship to
 * the browser bundle if a deployer points it at a paid/rate-limited
 * provider with a URL-embedded API key, unlike the Supabase/Sentry
 * values above. Read only inside `app/api/aave/reserve/route.ts`.
 * Falls back to a public default endpoint when unset, so Manual Mode's
 * "must run with no external services configured" guarantee is
 * preserved without requiring configuration.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('ProfitPilot'),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().min(1).default('USD'),
  NEXT_PUBLIC_PRICE_API_URL: z.string().url().optional().or(z.literal('')),
  COINGECKO_API_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  AAVE_RPC_URL: z.string().url().optional().or(z.literal('')),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
    NEXT_PUBLIC_PRICE_API_URL: process.env.NEXT_PUBLIC_PRICE_API_URL,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    AAVE_RPC_URL: process.env.AAVE_RPC_URL,
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

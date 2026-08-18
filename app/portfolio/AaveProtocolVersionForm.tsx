'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import { aaveV4PositionIdentitySchema } from '@/types/portfolio.schema';
import { deriveProtocolStatus, formatProtocolStatus } from '@/utils/protocolStatus';

/**
 * Aave Protocol Version selector — V4 Readiness Audit §12 Stage 13. The
 * "smallest clean place for a per-portfolio protocol selector" this
 * stage's own audit step asked for: a self-contained fieldset rendered
 * inside `PortfolioPageClient`, next to the other per-portfolio settings
 * forms already there (`PortfolioDetailsForm`, `CollateralPositionForm`,
 * `DebtPositionForm`), not inside the Portfolio *creation* flow
 * (`NewPortfolioPageClient.tsx`) — every new portfolio is still created
 * exactly as before (V3-shaped, `protocolVersion` unset), and V4 is an
 * opt-in choice made afterward, on an existing portfolio, matching
 * "switching V3 -> V4 -> V3 remains possible" and "one portfolio can be
 * V3 while another is V4" — both are per-portfolio *edit-time* states,
 * not creation-time ones.
 *
 * **Two already-existing Store actions do all the real work** —
 * `setProtocolVersion`/`setAaveV4Position` (`stores/portfolioStore.ts`,
 * Stage 5), both unchanged by this stage. This component is the first
 * real UI caller of either.
 *
 * **The radio group never touches `v4Position`.** Selecting "Aave V3"
 * calls only `setProtocolVersion(portfolioId, 'v3')` — `v4Position` (and
 * `v4DebtState`) stay exactly as they were, matching this stage's own
 * "preserve existing v4Position in storage... prefer hide/disable over
 * destructive delete" requirement. The address sub-form below is simply
 * not rendered while V3 is selected (`{version === 'v4' && ...}`), which
 * un-mounts and re-mounts it on each toggle — React Hook Form's own
 * `defaultValues` therefore always re-reads the portfolio's current,
 * real `v4Position.userAddress` (or blank, if never set) the moment V4
 * is selected again, rather than this component needing to track that
 * itself.
 *
 * **`aaveV4PositionIdentitySchema` (Stage 4A) reused unchanged** for
 * validation — the same schema `setAaveV4Position` itself re-validates
 * against, so a submission that passes here will also pass there. Not
 * tied to `stores/authStore.ts` in any way (`AaveV4PositionIdentity`'s
 * own doc comment: "not account/auth identity") — anonymous, fully local
 * portfolios can set this exactly like signed-in ones.
 *
 * **Does not fabricate a status.** `deriveProtocolStatus`
 * (`utils/protocolStatus.ts`) reads only real state: `v4Position`/
 * `v4DebtState` presence and `useAaveV4LiveDataStore`'s own live fetch
 * status — never a guessed or interpolated value.
 */
type V4AddressFormValues = z.input<typeof aaveV4PositionIdentitySchema>;

function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

export function AaveProtocolVersionForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const setProtocolVersion = usePortfolioStore((state) => state.setProtocolVersion);
  const setAaveV4Position = usePortfolioStore((state) => state.setAaveV4Position);
  const aaveV4Status = useAaveV4LiveDataStore((state) => state.status);
  const aaveV4LastFetchedAt = useAaveV4LiveDataStore((state) => state.lastFetchedAt);
  const aaveV4CollateralRiskStatus = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
  const aaveV4CollateralRiskLastFetchedAt = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.lastFetchedAt,
  );

  const version = portfolio.protocolVersion ?? 'v3';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<V4AddressFormValues, unknown, z.infer<typeof aaveV4PositionIdentitySchema>>({
    resolver: zodResolver(aaveV4PositionIdentitySchema),
    defaultValues: { userAddress: portfolio.v4Position?.userAddress ?? '' },
  });

  const onAddressSubmit = handleSubmit((data) => {
    setAaveV4Position(portfolioId, { userAddress: data.userAddress as `0x${string}` });
  });

  const status = deriveProtocolStatus({
    protocolVersion: portfolio.protocolVersion,
    v4PositionSet: portfolio.v4Position !== undefined,
    v4DebtStateSet: portfolio.v4DebtState !== undefined,
    aaveMarketQuote: null,
    aaveV4Status,
    aaveV4LastFetchedAt,
    v4CollateralRiskSet: portfolio.v4CollateralRisk !== undefined,
    aaveV4CollateralRiskStatus,
    aaveV4CollateralRiskLastFetchedAt,
    now: new Date().toISOString(),
  });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-foreground">Aave protocol version</legend>

      <div
        role="radiogroup"
        aria-label="Aave protocol version"
        className="flex flex-col gap-2 text-sm"
      >
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`protocolVersion-${portfolioId}`}
            value="v3"
            checked={version === 'v3'}
            onChange={() => setProtocolVersion(portfolioId, 'v3')}
          />
          Aave V3
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`protocolVersion-${portfolioId}`}
            value="v4"
            checked={version === 'v4'}
            onChange={() => setProtocolVersion(portfolioId, 'v4')}
          />
          Aave V4
        </label>
      </div>

      {version === 'v4' && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <form onSubmit={onAddressSubmit} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>
                On-chain address <RequiredMark />
              </span>
              <input
                id="v4Position.userAddress"
                aria-required="true"
                placeholder="0x..."
                {...register('userAddress')}
                aria-invalid={errors.userAddress ? 'true' : undefined}
                aria-describedby={errors.userAddress ? 'v4Position.userAddress-error' : undefined}
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              The wallet address whose Aave V4 position this portfolio&rsquo;s live debt figures are
              read from — not your sign-in identity.
            </p>
            {errors.userAddress && (
              <span id="v4Position.userAddress-error" className="text-xs text-destructive">
                {errors.userAddress.message}
              </span>
            )}
            <button
              type="submit"
              className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Save address
            </button>
            {isSubmitSuccessful && (
              <span className="text-xs text-muted-foreground" role="status">
                Saved.
              </span>
            )}
          </form>

          <p className="text-xs text-muted-foreground" role="status">
            <span className="rounded-full bg-muted px-2 py-0.5">
              {formatProtocolStatus(status)}
            </span>
          </p>
        </div>
      )}
    </fieldset>
  );
}

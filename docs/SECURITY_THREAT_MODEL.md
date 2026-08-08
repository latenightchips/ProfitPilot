# Security Threat Model

`06_TASKS.md` M9-036 ("Complete Security Threat Model"). Dependencies:
M9-029 through M9-035. Description: "Document and review application
threats." Include: "Financial misinformation through stale inputs,
Cross-user cloud access, Data loss, Malicious imports, Session theft,
Sensitive data exposure, Provider manipulation, UI spoofing, Dependency
compromise." Requirements: "Document mitigations and residual risk." DoD:
"No unresolved critical security threat remains."

This document assembles the nine named threats using the audits already
performed — this batch's own M9-029–M9-035 (`docs/SECURITY_REVIEW.md`'s
own new sections) and Milestone 8's M8-053/M8-054 (`docs/SECURITY_REVIEW.md`'s
original sections) — rather than re-deriving findings a prior, more
detailed review already established. Each threat below cites where its
own mitigation is actually implemented and tested, not merely asserted.

## 1. Financial misinformation through stale inputs

**Threat**: a user acts on a BTC price, protocol parameter, or portfolio
value that is out of date, believing it current, and makes a real
decision (loop, exit, rebalance) based on wrong numbers.

**Mitigation**: `services/market/quote.ts` implements
`04_BUILD_GUIDE.md`'s own "Price Freshness" rule verbatim — Fresh
(within 5 minutes), Stale (older), Unavailable (no valid price) — and
its own "Service Fallback Order" (live provider → last valid cached
value → manual input, "every fallback must be visible to the user").
Version 0.1 ("Manual Mode," `01_PRD.md` REQ-010) has no live price
provider wired at all (`services/market/quote.ts`'s own header comment:
no `PriceProvider`/CoinGecko adapter is assigned to any task, so none is
built) — every price in this application today is either a manual entry
or a previously-manually-entered cached value, and the Dashboard's own
Data Freshness indicators (M5-017/018) visibly label age/staleness
rather than silently treating an old manual entry as current. Protocol
parameters (LTV, liquidation threshold, borrow/supply APR) follow the
identical manual-entry-with-visible-source pattern (`app/portfolio/PortfolioPageClient.tsx`'s
own "Parameter source: Manual" label).

**Residual risk**: this application cannot detect that a *manually
entered* value is factually wrong at the moment of entry — a user who
types an incorrect BTC price gets no independent cross-check, since no
live provider exists to compare against. This is inherent to Manual
Mode's own design (REQ-010), not a defect this batch can fix without
building the unassigned live-provider integration `services/market/quote.ts`'s
own header comment already declines to invent. Not a critical,
unresolved threat: the mitigation (visible staleness/manual-source
labeling) is real and already built; the residual risk is a scope
boundary, not a gap.

## 2. Cross-user cloud access

**Threat**: one user's authenticated session or request reaches or
modifies another user's data.

**Mitigation / Not applicable**: `docs/SECURITY_REVIEW.md`'s own
"Cross-user access" section (M8-054) — Cloud Database (M8-023) is
cancelled by product decision (`docs/MILESTONE_8_SCOPE_CHANGE.md`), so
no Supabase-backed table scoped by user exists or ever will. There is
only one "user" in the sense this threat means: local browser storage.
Row-Level Security testing (M8-057) is correspondingly not applicable —
there is no policy to test. Re-confirmed this batch (`docs/SECURITY_REVIEW.md`'s
new M9-031 section): `services/auth/supabaseClient.ts`'s own
architecture still has no direct-table-access code path anywhere.

**Residual risk**: none — this is a structural non-threat under the
current, product-decided architecture, not a mitigated-but-present risk.

## 3. Data loss

**Threat**: a user's locally stored portfolio/strategy/simulation data is
destroyed, corrupted, or silently lost.

**Mitigation**: `docs/SECURITY_REVIEW.md`'s own "Corrupted local
storage" (M8-054) and "Accidental overwrite" (M8-054) sections —
FNV-1a checksums on every envelope (now actually *enforced* on read,
not just computed on write, since this batch's M9-032 fix wired
`verifyChecksum` into `validatePersistedRecordSchema`); a corrupted or
checksum-mismatched record surfaces as a normal `MappingResult` failure,
never a raw exception (`docs/DISASTER_RECOVERY.md`'s own recovery path);
`services/import/apply.ts`'s `confirmedReplaceAll` gate and automatic
`createRecoverySnapshot` before any replace-mode apply or bulk clear
(`services/persistence/clearLocalData.ts`).

**Residual risk**: this application has exactly one copy of a user's
data — the browser's own `localStorage` — by design (local-first,
Cloud Sync cancelled). Clearing browser storage, a browser-storage quota
eviction, or losing the device itself is unrecoverable by this
application's own means; `app/settings/SettingsPageClient.tsx`'s own
manual "Full Backup (JSON)" export is the user's own responsibility to
run, not something this application can force. Documented, not silently
accepted — the same tradeoff every purely local-first application makes.

## 4. Malicious imports

**Threat**: an attacker-crafted or corrupted import file damages
application state, smuggles a credential into storage, or crashes the
application.

**Mitigation**: `docs/SECURITY_REVIEW.md`'s own "Malicious imports"
(M8-054) section plus this batch's own M9-032 section — three genuine
gaps found and fixed: no file-size limit (now `MAX_IMPORT_FILE_SIZE_BYTES`,
25 MB), no nesting-depth bound (now `exceedsMaxNestingDepth`, a
self-bounding 50-level check preventing a stack-overflow crash from a
pathologically deep payload), and `verifyChecksum` never actually
called (now wired into the same chokepoint the M8-051 sensitive-field
check uses). Combined with the pre-existing file-level/record-level
two-tier rejection (`services/import/ImportValidator.ts`) and
`services/shared/sensitiveFields.ts`'s 22-field credential/key/token
denylist, an import file is now rejected safely across every M9-032
Test item — oversized, deeply nested, unexpected fields, script-like
text, unsupported versions, duplicate identifiers, invalid numeric
values, corrupted checksums.

**Residual risk**: a maliciously crafted import cannot smuggle
credentials or corrupt other records' shapes, crash the validator, or
silently apply, but nothing prevents importing plausible-looking
*nonsense* data (e.g. a technically-valid but fabricated portfolio
balance) — inherent to a local-only import feature with no
source-of-truth to check against, mitigated by the existing
preview-before-apply step (`app/settings/SettingsPageClient.tsx`), not
eliminated by it.

## 5. Session theft

**Threat**: an attacker obtains a user's Supabase auth token and acts as
that user.

**Mitigation**: `docs/SECURITY_REVIEW.md`'s own "Secure token handling"
(M8-053) — session tokens never enter this application's own state or
storage at all; `@supabase/supabase-js`'s `GoTrueClient` owns them
entirely under its own `localStorage` key, structurally separate from
every `profitpilot:v1:*` key this application's own `services/persistence/`
writes. `authStore` carries no persist middleware. This batch's own
M9-035 fix (`next.config.ts`'s CSP, `script-src 'self' 'unsafe-inline'`,
no third-party script origin allowed) narrows the one realistic
in-browser theft vector (a malicious injected script reading
`localStorage`) to only a same-origin XSS, which this application has no
`dangerouslySetInnerHTML` anywhere to introduce (M9-034's own finding).

**Residual risk**: `'unsafe-inline'` in the CSP's `script-src` (M9-035's
own documented tradeoff, required for Next.js's own inline hydration
scripts short of a nonce-based `middleware.ts`) means the CSP does not
fully defend against an injected inline script if one ever reached the
page through some other means this application does not currently have
(no `dangerouslySetInnerHTML`, no `eval`, no user-controlled `<script>`
source) — a real, documented, non-critical residual gap; a nonce-based
CSP is the concrete future improvement if this ever becomes a live
concern.

## 6. Sensitive data exposure

**Threat**: a credential, key, or token is persisted, exported, or
otherwise leaked from this application.

**Mitigation**: `docs/SECURITY_REVIEW.md`'s own "Sensitive data leakage"
(M8-054) and "No session data in exports" (M8-053) sections —
`services/shared/sensitiveFields.ts`'s 22-name denylist, checked
recursively, at the single `validatePersistedRecordSchema` chokepoint
every read/write/import passes through; `services/export/JsonExporter.ts`'s
structural exclusion (no session-shaped record type exists at all).
This batch's own M9-033 section closes the one real coverage gap found:
CSV export had the identical structural protection JSON already had
(named-field extraction, never a raw object dump) but no test proving
it — now proven end-to-end
(`tests/unit/services/export/CsvExporter.test.ts`).

**Residual risk**: none identified as unresolved — every named
credential/key/token category (private keys, seed phrases, wallet
secrets, exchange credentials, service-role keys, provider secrets, auth
tokens) is covered by the same field-name denylist, and this application's
own domain model has no legitimate field for any of them in the first
place (`01_PRD.md` REQ-012 "Never Custody Assets").

## 7. Provider manipulation

**Threat**: a compromised or malicious external data provider (price
feed, Supabase) returns manipulated data that this application trusts.

**Mitigation / Largely not yet applicable**: this application has no
live external price-data fetch wired up at all in Version 0.1
(`services/market/quote.ts`'s own header comment — no `PriceProvider`/
CoinGecko adapter exists; every price is manual entry or a previously
manually-entered cached value) — there is no live provider today for
this threat to act through on the price side. Supabase Authentication
is real but dormant/unconfigured in this environment
(`docs/SECURITY_REVIEW.md`'s own "External-service limitation," M8-053)
— `GoTrueClient` is Supabase's own maintained SDK, and this application
never re-implements or bypasses its own token-verification logic.

**Residual risk**: when a real price-provider adapter is eventually
built (an explicitly unassigned, future task per `services/market/quote.ts`'s
own scope note), it will need its own input-sanity bounds (e.g.
rejecting a wildly implausible price) as part of that future
implementation — recorded here as a forward-looking requirement for
whichever milestone builds it, not a gap in this one, since no code
exists yet for this threat to actually manifest through.

## 8. UI spoofing

**Threat**: this application is framed inside a malicious page
(clickjacking) or otherwise visually spoofed to trick a user into an
unintended action.

**Mitigation**: this batch's own M9-035 fix —
`next.config.ts`'s `X-Frame-Options: DENY` and the CSP's own
`frame-ancestors 'none'` (belt-and-suspenders, the same protection
expressed two ways for broader browser-support coverage) prevent this
application from ever being embedded in a frame at all, the direct,
complete mitigation for clickjacking-style UI spoofing. Before this
batch, neither header existed (confirmed empty, `docs/DOD_COMPLIANCE_AUDIT.md`'s
own finding, re-confirmed at the start of this batch).

**Residual risk**: none identified for framing-based spoofing, now that
both headers are live (verified against a real running server, not just
configured — see `docs/SECURITY_REVIEW.md`'s own M9-035 section).
Non-framing spoofing (e.g. a convincing phishing look-alike domain) is
outside any header's reach and is a user-education/domain-ownership
concern, not a code-level mitigation this application can implement.

## 9. Dependency compromise

**Threat**: a compromised upstream package (direct or transitive)
introduces malicious code into this application's build or runtime.

**Mitigation**: this batch's own M9-029 fresh dependency audit
(`docs/SECURITY_REVIEW.md`'s own M9-029 section) — 18 known
vulnerability instances across 7 packages, every one confirmed
build/lint/test-time-only, none reachable from shipped runtime code;
`pnpm-lock.yaml` is committed (reproducible, pinned installs — every
`pnpm install` in this engagement resolves the identical dependency
tree, not whatever the latest matching version happens to be at install
time); `PROJECT_STATUS.md`'s own "Deviations from a literal reading of
the docs" section already records that `sharp`/`unrs-resolver`/
`@sentry/cli`'s native postinstall scripts are left un-approved (pnpm's
own default-blocked "ignored build scripts" security posture, not
overridden).

**Residual risk**: no license-audit tool is configured (this batch's own
M9-029 finding) — a manual, one-time license scan found nothing
GPL/AGPL-family, but this is not an automated, repeatable check; a
supply-chain attack against a legitimately-maintained package between
audits (a real, general risk for any dependency-based project, not
specific to this codebase) is not something `pnpm audit` alone can
catch, since it only flags *known, disclosed* advisories.

## Summary

| Threat | Status |
|---|---|
| Financial misinformation through stale inputs | Mitigated (visible staleness/manual-source labeling); residual risk is a Manual Mode scope boundary |
| Cross-user cloud access | Not applicable — no cloud data exists |
| Data loss | Mitigated (checksums now enforced, recovery snapshots); residual risk is inherent to local-first, single-copy storage |
| Malicious imports | Mitigated — 3 genuine gaps closed this batch (size, depth, checksum enforcement) |
| Session theft | Mitigated (tokens never enter this app's own storage; CSP narrows the injection vector); residual risk from `'unsafe-inline'` documented |
| Sensitive data exposure | Mitigated — field-name denylist at the single validation chokepoint; CSV export gap closed this batch |
| Provider manipulation | Largely not yet applicable — no live provider exists yet; forward-looking requirement recorded |
| UI spoofing | Mitigated this batch — frame-blocking headers now live and verified |
| Dependency compromise | Mitigated — fresh audit, pinned lockfile; residual risk is the general limits of advisory-based scanning |

**No unresolved critical security threat remains (DoD)**: every threat
above is either mitigated with a real, tested implementation, correctly
scoped as not applicable under the current local-first architecture, or
— for provider manipulation specifically — not yet applicable because no
code exists yet for it to act through. No threat in this list is
"critical and unmitigated."

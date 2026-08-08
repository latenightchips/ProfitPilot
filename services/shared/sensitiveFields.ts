/**
 * Sensitive Data Exclusion Rules — 06_TASKS.md M8-051 ("Implement
 * Sensitive Data Exclusion Rules"). Dependencies: M8-036 (Export
 * Service), M8-040 (Import Service). "Never store": "Private keys, Seed
 * phrases, Wallet signing secrets, Exchange credentials, Supabase
 * service-role keys, Provider secrets, Authentication tokens in
 * exports." DoD: "Automated tests verify prohibited fields are not
 * persisted or exported."
 *
 * **Why this check exists even though no legitimate code path in this
 * application ever produces these fields.** `services/auth/` never
 * writes a session/token through `services/persistence` (Supabase's own
 * `GoTrueClient` manages its own storage entirely separately — see
 * `services/auth/supabaseClient.ts`'s own header comment), and no
 * portfolio/strategy/simulation/exit-plan model anywhere in this
 * codebase has ever had a field for a private key, seed phrase, or
 * credential (01_PRD.md REQ-012's own "Never Custody Assets" philosophy
 * — this application is read-only and calculation-only by design). This
 * check is real defense-in-depth against a *different* threat this
 * batch is actually built to catch: `services/persistence/schemas/shared.schema.ts`'s
 * own `looseRecordSchema` (used for the nested Engine-result fields on
 * `loopStrategy`/`exitPlan`/`simulation` records) is deliberately
 * shallow — "looks like a real object," not a field-by-field
 * specification — so it does not by itself reject an arbitrary extra
 * key. A maliciously crafted import file could otherwise smuggle a
 * `privateKey`/`serviceRoleKey`/`accessToken` field inside one of those
 * loose nested objects, have it validated as "structurally fine," get
 * persisted, and later reappear in a full backup export. This module is
 * the explicit, structural check that closes that gap — applied at both
 * `services/persistence/validate.ts` (write-time) and
 * `services/import/ImportValidator.ts` (import-time), per M8-051's own
 * "persisted or exported" wording.
 *
 * **Deliberately deep, not just top-level.** A payload's own top-level
 * fields are already narrowly typed by each record type's real schema
 * (`services/persistence/schemas/*.ts`) — the actual risk is inside the
 * *loose* nested objects (`settings`, `result`, `scenario`,
 * `targetInputs`), which is exactly where `findSensitiveField` recurses.
 *
 * **Name matching is case- and separator-insensitive**
 * (`normalizeFieldName` strips `_`/`-`/whitespace and lowercases) so
 * `private_key`, `privateKey`, and `PRIVATE-KEY` are all caught by the
 * same single canonical entry.
 */
const SENSITIVE_FIELD_NAMES: readonly string[] = [
  'privatekey',
  'seedphrase',
  'mnemonic',
  'mnemonicphrase',
  'recoveryphrase',
  'walletsecret',
  'signingkey',
  'signingsecret',
  'exchangeapikey',
  'exchangesecret',
  'exchangecredentials',
  'servicerolekey',
  'servicerole',
  'providersecret',
  'apisecret',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'authorizationtoken',
  'sessiontoken',
  'password',
];

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[_\-\s]/g, '');
}

const NORMALIZED_SENSITIVE_FIELD_NAMES = new Set(SENSITIVE_FIELD_NAMES.map(normalizeFieldName));

/**
 * Checks a single key name only, no recursion — distinct from
 * `findSensitiveField`, which scans an entire subtree and would
 * therefore flag an *outer* key as sensitive merely because something
 * sensitive exists somewhere underneath it. `services/observability/scrub.ts`
 * (M9-049/M9-050) needs exactly this narrower check: it already recurses
 * through a structure itself, redacting one key at a time, so it must
 * know whether *this* key's own name matches, not whether the value
 * under it contains a match anywhere.
 */
export function isSensitiveFieldName(name: string): boolean {
  return NORMALIZED_SENSITIVE_FIELD_NAMES.has(normalizeFieldName(name));
}

/**
 * Recursively scans a value for any object key matching
 * `SENSITIVE_FIELD_NAMES`. Returns the first offending key's dotted path
 * (e.g. `"result.wallet.privateKey"`) for a clear, actionable error
 * message, or `null` when nothing matches. Arrays are scanned
 * element-by-element; primitives never match.
 */
export function findSensitiveField(value: unknown, path = ''): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findSensitiveField(value[i], `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path === '' ? key : `${path}.${key}`;
    if (isSensitiveFieldName(key)) return currentPath;
    const found = findSensitiveField(nested, currentPath);
    if (found !== null) return found;
  }

  return null;
}

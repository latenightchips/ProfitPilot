/**
 * Fake Supabase database — test-support fixture for the future
 * `services/persistence/adapters/supabase.adapter.ts` (M8-025) and
 * `services/persistence/sync.service.ts` (M8-027 onward), neither of
 * which exists yet. Authorized as "local-only Cloud Preparation" work
 * alongside M8-026 ("Create Synchronization Model").
 *
 * **This is not a real adapter, and it does not validate real Row-Level
 * Security.** It models the narrow row-level table surface a future
 * adapter will call (`docs/CLOUD_READINESS.md` §4.2's illustrative
 * `(id, user_id, record_id, storage_schema_version, app_version, payload,
 * checksum, created_at, updated_at)` shape), with an in-memory,
 * hand-written ownership check standing in for what real Postgres RLS
 * policies would enforce — useful for proving a future adapter's own
 * *logic* is correct (does it scope reads/writes to the current user? does
 * it map rows to `StorageEnvelope<T>` correctly? does it surface an error
 * instead of throwing?), but it is **not** a substitute for M8-057's real
 * RLS tests. `docs/CLOUD_READINESS.md` §6 already states why: verifying
 * that Postgres itself denies cross-user access is structurally
 * impossible to fake — this fixture's ownership check is a plain
 * `if (row.userId !== currentUserId)` in TypeScript, not a database
 * policy, and proves nothing about whether a real RLS policy is written
 * or enabled correctly.
 */

export interface FakeSupabaseRow {
  id: string;
  userId: string;
  recordId: string;
  storageSchemaVersion: string;
  appVersion: string;
  payload: unknown;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FakeSupabaseQueryError {
  message: string;
  code?: string;
}

export interface FakeSupabaseResult<T> {
  data: T;
  error: FakeSupabaseQueryError | null;
}

const RLS_DENIED_ERROR: FakeSupabaseQueryError = {
  message: 'Row-level security policy violation.',
  code: 'RLS_DENIED',
};

function ok<T>(data: T): FakeSupabaseResult<T> {
  return { data, error: null };
}

function fail<T>(error: FakeSupabaseQueryError, empty: T): FakeSupabaseResult<T> {
  return { data: empty, error };
}

/**
 * `currentUserId` mirrors `auth.uid()` in a real RLS policy — every
 * operation below is scoped to it, the same "always filter by the
 * authenticated user" shape a real Supabase adapter must follow
 * (04_BUILD_GUIDE.md "SUPABASE SECURITY": "Never rely only on frontend
 * filtering" — a reminder this fake exists to help a future adapter's
 * *code* honor, not a claim that honoring it here proves the real
 * database will too).
 */
export class FakeSupabaseDatabase {
  private readonly tables = new Map<string, FakeSupabaseRow[]>();
  private currentUserId: string | null;
  private forcedError: FakeSupabaseQueryError | null = null;

  constructor(currentUserId: string | null = null) {
    this.currentUserId = currentUserId;
  }

  setCurrentUser(userId: string | null): void {
    this.currentUserId = userId;
  }

  /** The next call to any method below returns this error instead of succeeding — reset after one use. */
  forceNextError(error: FakeSupabaseQueryError): void {
    this.forcedError = error;
  }

  private consumeForcedError(): FakeSupabaseQueryError | null {
    const error = this.forcedError;
    this.forcedError = null;
    return error;
  }

  private rows(table: string): FakeSupabaseRow[] {
    let existing = this.tables.get(table);
    if (existing === undefined) {
      existing = [];
      this.tables.set(table, existing);
    }
    return existing;
  }

  async selectByRecordId(
    table: string,
    recordId: string,
  ): Promise<FakeSupabaseResult<FakeSupabaseRow | null>> {
    const forced = this.consumeForcedError();
    if (forced !== null) return fail(forced, null);
    if (this.currentUserId === null) return fail(RLS_DENIED_ERROR, null);

    const found =
      this.rows(table).find(
        (row) => row.recordId === recordId && row.userId === this.currentUserId,
      ) ?? null;
    return ok(found);
  }

  async selectAllOwned(table: string): Promise<FakeSupabaseResult<FakeSupabaseRow[]>> {
    const forced = this.consumeForcedError();
    if (forced !== null) return fail(forced, []);
    if (this.currentUserId === null) return fail(RLS_DENIED_ERROR, []);

    return ok(this.rows(table).filter((row) => row.userId === this.currentUserId));
  }

  async insert(
    table: string,
    row: Omit<FakeSupabaseRow, 'id'>,
  ): Promise<FakeSupabaseResult<FakeSupabaseRow | null>> {
    const forced = this.consumeForcedError();
    if (forced !== null) return fail(forced, null);
    if (this.currentUserId === null || row.userId !== this.currentUserId) {
      return fail(RLS_DENIED_ERROR, null);
    }

    const inserted: FakeSupabaseRow = { ...row, id: crypto.randomUUID() };
    this.rows(table).push(inserted);
    return ok(inserted);
  }

  async update(
    table: string,
    recordId: string,
    patch: Partial<Omit<FakeSupabaseRow, 'id' | 'userId' | 'recordId'>>,
  ): Promise<FakeSupabaseResult<FakeSupabaseRow | null>> {
    const forced = this.consumeForcedError();
    if (forced !== null) return fail(forced, null);
    if (this.currentUserId === null) return fail(RLS_DENIED_ERROR, null);

    const rows = this.rows(table);
    const index = rows.findIndex(
      (row) => row.recordId === recordId && row.userId === this.currentUserId,
    );
    if (index === -1) return fail(RLS_DENIED_ERROR, null);

    const updated = { ...rows[index], ...patch } as FakeSupabaseRow;
    rows[index] = updated;
    return ok(updated);
  }

  async delete(table: string, recordId: string): Promise<FakeSupabaseResult<void>> {
    const forced = this.consumeForcedError();
    if (forced !== null) return fail(forced, undefined);
    if (this.currentUserId === null) return fail(RLS_DENIED_ERROR, undefined);

    const rows = this.rows(table);
    const index = rows.findIndex(
      (row) => row.recordId === recordId && row.userId === this.currentUserId,
    );
    if (index === -1) return fail(RLS_DENIED_ERROR, undefined);

    rows.splice(index, 1);
    return ok(undefined);
  }

  /** Test-only escape hatch — seed a row directly, bypassing ownership checks, to set up cross-user scenarios. */
  seedRow(table: string, row: Omit<FakeSupabaseRow, 'id'> & { id?: string }): FakeSupabaseRow {
    const seeded: FakeSupabaseRow = { ...row, id: row.id ?? crypto.randomUUID() };
    this.rows(table).push(seeded);
    return seeded;
  }
}

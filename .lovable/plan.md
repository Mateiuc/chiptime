# Fix spurious-toast bug in mergeOnConflict via 3-way diff

## Problem

`mergeOnConflict` in `src/hooks/useStorage.ts` flags an "overlap" whenever `local !== remote` for an id the local side just touched. That fires even when the remote simply hasn't seen the local edit yet (no real conflict). The fix is to cache the last-known server snapshot as a **base** and switch overlap detection to a 3-way diff: overlap requires both sides to have diverged from base AND disagree.

## Changes

### 1. `src/services/appSyncService.ts` — cache base snapshot

- Add module-local `let baseSnapshot: SyncData | null = null` next to `lastKnownVersion`.
- Add `getBaseSnapshot(): SyncData | null` to the exported service.
- Update `baseSnapshot` (deep clone via `structuredClone` or `JSON.parse(JSON.stringify(...))`) at every point where the server state becomes known:
  - End of `pullFromCloud` (after success): clone the pulled `syncData`.
  - End of `pushToCloud` UPDATE-success branch: clone the just-pushed `sanitized` payload (server now holds this).
  - End of `pushToCloud` INSERT-success branch: same.
  - Inside the conflict branches (UPDATE returning 0 rows, and INSERT 23505 fallback): after `pullFromCloud` returns `fresh`, `pullFromCloud` itself already updates `baseSnapshot`, so no extra work needed — but verify the order so the `VersionConflictError` consumer sees an up-to-date base when it calls `getBaseSnapshot()`.
- Reset `baseSnapshot = null` wherever `lastKnownVersion` is reset (`setWorkspaceId`).

### 2. `src/hooks/useStorage.ts` — 3-way merge

- Change `mergeOnConflict` signature to `(local, remote, base, changed)`.
- Inside `mergeArr`, build `baseMap = byId(baseArr || [])`. For each id present in `changedSet`:
  ```
  const bItem = baseMap.get(id);
  const lItem = localMap.get(id);
  const rItem = remoteMap.get(id);
  const localChanged  = stringify(lItem)  !== stringify(bItem);
  const remoteChanged = stringify(rItem)  !== stringify(bItem);
  if (localChanged && remoteChanged && stringify(lItem) !== stringify(rItem)) {
    overlapped = true;
  }
  ```
  Existing merge rule unchanged: id in `changedSet` → take local; otherwise take remote.
- Settings: same idea — overlap only when `ch.settingsChanged && stringify(local.settings) !== stringify(base.settings) && stringify(remote.settings) !== stringify(base.settings) && stringify(local.settings) !== stringify(remote.settings)`.
- Creation/deletion edge cases (id missing in base, local, or remote in any combination): never set `overlapped`. Falls out naturally because if `bItem` is undefined and only one side has the item, `localChanged` XOR `remoteChanged` is true — never both.
- Both call sites (`immediatePushToCloud`, `pushNow`) pass `appSyncService.getBaseSnapshot()` as the new `base` argument.

### 3. Edge case — no base yet (step 4)

**Decision:** when `base` is `null`, skip overlap detection entirely (treat as "no overlap, silent merge"). Rationale: a missing base means we have no evidence anything was concurrently edited from a shared point, so any toast would be a guess. The merge itself still runs (local-wins for `changedIds`, remote-wins for the rest), so data is preserved either way. Documented inline in `mergeOnConflict`.

### 4. Tests — `src/hooks/__tests__/useStorage.race.test.ts`

- **G** — non-overlapping concurrent edits → now passes (no toast). Update the test setup so the harness primes a base snapshot via a `pullSpy` mock OR by exposing a small test helper on `appSyncService` that seeds `baseSnapshot`. Cleanest: add an internal `__setBaseSnapshotForTest` (only used by tests) OR have the test call the real `pullFromCloud` against the existing mock queue first. Prefer the latter for fewer surface-area changes.
- **G2 (new)** — local edits ids `[A, B]`, remote independently edits ids `[C, D]`, base contains pristine A/B/C/D. Conflict thrown, merge silently combines all four; assert no toast.
- **H** — same-field conflict on id A: base has `status: pending`, local has `status: paid`, remote has `status: billed` → toast still fires.
- **I, J** — unchanged.
- **K (new)** — first sync, no base seeded. Local has edits, push throws `VersionConflictError`, merge runs without a base. Assert: no toast (per step 3 decision), data merges with local-wins for `changedIds`, retry push succeeds.

### 5. Verification

- `bunx vitest run` — all suites green (6 service + 5 hook tests).
- Note in final reply summarising the step-4 decision (silent merge when base is null).

## Out of scope

- No source changes beyond `appSyncService.ts` and `useStorage.ts`.
- No CI wiring (none exists in repo).
- No changes to push-retry timing, sanitisation, or DB schema.

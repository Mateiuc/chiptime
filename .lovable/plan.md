# Vitest Suite for app_sync Race Reconciliation

## Scope

Pin down JS reconciliation behavior in `appSyncService.ts` and `useStorage.ts` as deterministic, offline regression tests. No live Supabase, no real network, no real timers.

## Pre-flight

The project does not currently have Vitest installed (no `vitest.config.*`, no `src/test/`, deps absent from `package.json`). Step 1 bootstraps testing per the project's standard testing setup.

## Files to create

1. **`vitest.config.ts`** — jsdom environment, `@` alias, setup file.
2. **`src/test/setup.ts`** — `@testing-library/jest-dom`, `matchMedia` shim.
3. **`src/test/mockSupabase.ts`** — programmable stub:
   - `createMockSupabase()` returns `{ supabase, queue }`.
   - `queue.push({ kind: 'select'|'update'|'insert', result: { data, error } })` — each terminal call (`maybeSingle`, `single`, awaited builder) shifts one entry.
   - Builder methods (`from`, `select`, `update`, `insert`, `upsert`, `eq`) are chainable spies that record calls into `queue.calls` for assertions like `expect(calls).toContainEqual({ method: 'eq', args: ['data_version', 5] })`.
4. **`src/services/__tests__/appSyncService.test.ts`** — cases A–F.
5. **`src/hooks/__tests__/useStorage.race.test.ts`** — cases G–J.

## Mocking strategy

- `vi.mock('@/integrations/supabase/client', () => ({ supabase: mock }))` at the top of `appSyncService.test.ts`.
- For `useStorage.race.test.ts`: `vi.mock('@/services/appSyncService', ...)` exposing programmable `pushToCloud`, `pullFromCloud`, plus the **real** `VersionConflictError` class (re-exported from the actual module via `vi.importActual` so `instanceof` checks in `useStorage.ts` still pass). Also `vi.mock('@/lib/capacitorStorage')` with an in-memory backing store, and `vi.mock('@/hooks/use-toast')` with a spy to assert toast calls.
- Reset module-local `lastKnownVersion` between tests by re-importing via `vi.resetModules()` in `beforeEach` (the cache lives at module scope in `appSyncService.ts`).
- Seed `localStorage` with `app_sync_workspace_id = 'ws-test'` in `beforeEach`.

## Test cases mapped to current code

### appSyncService (A–F)

- **A. Successful UPDATE** — pre-set `lastKnownVersion=5` via prior pull; queue update result `{ data_version: 6, updated_at: ISO }`. Assert resolved value `{ version: 6, updatedAt }` and recorded `eq('data_version', 5)` call.
- **B. Conflict** — queue update returning `{ data: null }` (zero rows), then queue a select for `pullFromCloud` returning `{ data: {...remote}, data_version: 7, updated_at }`. Assert `VersionConflictError` thrown with `remoteVersion === 7`.
- **C. Insert path** — `lastKnownVersion=null` and `getRemoteVersion` queue returns null; queue insert returning `{ data_version: 1 }`. Assert resolves with version 1.
- **D. 23505 fallback** — queue insert that errors with `{ code: '23505' }`, then a `getRemoteVersion` select returning 3, then a `pullFromCloud` select returning fresh remote. Assert `VersionConflictError` (current code's documented behavior at lines ~167–177 of `appSyncService.ts`).
- **E. `pullFromCloud`** — queue select returning `{ data, data_version: 42, updated_at }`. Assert returned `{ data, version: 42 }` and that a subsequent `pushToCloud` uses `eq('data_version', 42)` (verifies `lastKnownVersion` cache update).
- **F. Sanitization** — push data with `clients[0].accessCode = '1234'` and `settings.googleApiKey = 'k'`. Assert the payload captured by the update spy has `accessCode` and `googleApiKey` stripped.

### useStorage (G–J)

Use `renderHook` from `@testing-library/react` on `useTasks`. Seed mock `capacitorStorage` with initial tasks. Call mutation methods and `await` them.

- **G. Non-overlap merge** — local `[A, B]`, user edits A → `setTasks([A', B], ['A'])`. Mock `pushToCloud`: 1st call throws `VersionConflictError({ tasks: [A_unchanged, B_remote_edited] })`, 2nd resolves. Assert final `capacitorStorage` tasks contain `A'` and `B_remote_edited`; `toast` spy NOT called with conflict variant; `cloudSyncEvents.triggerPull` listener fires (register a spy via `cloudSyncEvents.onPull`).
- **H. Same-field overlap** — local edits A.status='paid'; remote A.status='billed'. Assert final A.status==='paid' AND `toast` called with destructive "Conflicting edits reconciled" message.
- **I. Hard conflict** — both push attempts throw `VersionConflictError`. Assert destructive "Sync conflict / Please reload" toast fires; no third push attempt (assert `pushToCloud` mock called exactly 2 times); no infinite loop (test completes within `vi.runAllTimersAsync()`).
- **J. `pushNow` desktop** — call exported `pushNow(snapshot)` directly. 1st throws `VersionConflictError` with remote containing extra task D; 2nd resolves. Assert merged snapshot written to `capacitorStorage` contains A, B, C from local + D from remote.

## Determinism

- `vi.useFakeTimers()` in cases that touch the 5s retry timer (none here strictly need it since we never trigger non-conflict failures in I, but timers stay fake to fail loudly on accidental real `setTimeout`).
- No `await new Promise(setTimeout...)` — flush via `await Promise.resolve()` and `vi.runAllTimersAsync()`.

## Deliverables

- Test files + helper.
- Run `bunx vitest run`; report pass/fail counts.
- If any case **fails on current code**, stop and report the bug rather than weaken the assertion (per user instruction).
- No CI config exists in repo; will note that running `bunx vitest run` locally / in any CI step is sufficient.

## Out of scope

- No edits to `appSyncService.ts` or `useStorage.ts` unless a test surfaces a real bug (then: report first, fix only after user approval).

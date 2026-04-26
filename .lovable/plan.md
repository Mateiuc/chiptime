# Write every mutation to local + cloud simultaneously

## Goal
Every add / edit / delete / start / pause / resume / stop must persist to **local storage AND the cloud at the same time**, instead of the 3-second debounced background push that exists today.

## Root cause
In `src/hooks/useStorage.ts`, every `setClients` / `setVehicles` / `setTasks` / `setSettings` writes locally, then calls `debouncedPushToCloud()` which waits **3 seconds** before pushing. If the user closes the tab, navigates, or the network drops in that window, the cloud copy stays stale. Timer events (start/pause/resume/stop) all flow through `updateTask`, so they hit the same debounce.

## Changes

### 1. `src/hooks/useStorage.ts` — replace debounced push with immediate push
- Add `immediatePushToCloud()` that:
  - Cancels any pending debounced timer.
  - Reads the freshest local snapshot from `capacitorStorage`.
  - Skips empty snapshots (existing safety guard).
  - Skips if `!cloudPushEnabled`.
  - Awaits `appSyncService.pushToCloud(...)`.
- Replace every `debouncedPushToCloud()` call inside `setClients`, `setVehicles`, `setTasks`, `setSettings` with `await immediatePushToCloud()` so the local write and the cloud write resolve together.
- Keep `pushNow()` exported for the desktop view (now just calls the same helper).
- Keep the `cloudPushEnabled` flag so desktop/read-only mode still works.

### 2. Mutation paths already funnel through `setX`
No further changes needed — `addClient`, `updateClient`, `deleteClient`, `addVehicle`, `updateVehicle`, `deleteVehicle`, `addTask`, `updateTask`, `deleteTask`, `batchUpdateTasks`, and `setSettings` all route through the four `setX` functions, so updating those four covers every add/edit/delete and every timer start/pause/resume/stop (which are `updateTask` calls).

### 3. Resilience — single retry on transient failure
- If `pushToCloud` throws (offline, 5xx), enqueue ONE retry via a short timer (~5 s). Local data is already safe; this is best-effort recovery so we don't lose the cloud copy on a flaky network.
- Log clearly to console so issues are debuggable.

### 4. No schema changes
No DB migration. RLS, tables, and `appSyncService` stay as-is. The `app_sync` upsert is already idempotent on `workspace_id`.

## Files touched
- `src/hooks/useStorage.ts` — swap debounced push for immediate push, add lightweight retry.

## Out of scope
- Read-side cloud pull on login (already fixed last turn).
- Portal sync, photo sync, diagnostic upload (already immediate).
- UI changes.

## Verification
- Add a client → reload immediately → client persists from cloud.
- Start a task → close tab within 1 s → reopen on another device → timer state is current.
- Stop a task while offline → console shows retry → coming back online pushes successfully.
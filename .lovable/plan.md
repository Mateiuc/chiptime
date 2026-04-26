## Goal
After clearing browser cache (or signing in on a new device), the app should automatically restore data from the cloud instead of showing an empty UI.

## Root cause
1. `appSyncService.getWorkspaceId()` reads `app_sync_workspace_id` from `localStorage`. Clearing cache wipes it.
2. `useCloudSync` runs on mount **before** `AuthContext.loadWorkspace()` finishes setting it back, so the pull silently no-ops (`workspaceId` is null → `pullFromCloud` returns null).
3. Result: local IndexedDB/Preferences is empty AND no cloud pull happens → user sees empty app.

## Fix
Make the workspace ID **always derive from the server** on login, and gate the cloud pull on it being ready. Pull from cloud whenever local is empty.

### 1. `src/contexts/AuthContext.tsx`
- After `loadWorkspace` resolves a `workspace_members` row, also call the existing RPC `user_primary_workspace(_user_id)` as a fallback if no row is found (covers users with claimed workspaces but no row yet — rare). Keep current logic; just guarantee `appSyncService.setWorkspaceId(ws.id)` is invoked synchronously before any consumer hook tries to use it.
- Expose a new `workspaceReady: boolean` flag on the context (true once the workspace lookup completes — found or not).

### 2. `src/hooks/useStorage.ts` — `useCloudSync`
Change the mount-sync logic to:
1. **Wait** for `workspaceReady === true` and `workspace?.id` from `useAuth()` before doing anything.
2. Read local data counts:
   - If local is **empty** (`clients.length === 0 && tasks.length === 0 && vehicles.length === 0`) → **always pull from cloud**, regardless of timestamp. This is the "fresh device / cleared cache" case.
   - If local has data → keep current behavior (pull only if remote is newer; otherwise seed).
3. Re-run this effect when `workspace?.id` changes (so signing into a different account also triggers a fresh pull).

### 3. `src/services/appSyncService.ts`
- Remove reliance on `localStorage` as the source of truth for workspace_id. Keep the cache for fast access, but add `setWorkspaceId` calls from the AuthContext as the only writer.
- No schema changes needed — table already has `workspace_id` and proper RLS.

## Out of scope
- No UI changes. No DB migrations. No changes to push logic (already debounced and safe — won't push empty snapshots).

## Verification
- Sign in → clear site data → sign in again → data reappears within ~1s.
- Sign in on a second browser → data appears.
- Console shows: `[CloudSync] Local empty — forcing pull from cloud`.

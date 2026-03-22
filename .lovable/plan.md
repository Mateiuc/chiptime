

# Fix: App Sync Data Not Loading on Mobile

## Problem
The `app_sync` table currently has an `USING (false)` RLS policy for ALL commands, blocking all direct reads and writes. However, `appSyncService.ts` accesses this table directly via the Supabase client (anon key). This means:
- `pullFromCloud()` returns null (no data)
- `pushToCloud()` silently fails
- The mobile app loads with empty state

## Root Cause
A restrictive RLS policy ("No direct access to app_sync" with `USING (false)`) was applied to the `app_sync` table, but the code was never updated to use an edge function proxy (like `get-portal` does for `client_portals`). The original open RLS policies were replaced.

## Solution: Create a `sync-data` Edge Function
Rather than reverting to open RLS (which exposes all sync data publicly), create an edge function that validates the sync key server-side and proxies push/pull operations. This matches the architecture described for the project.

### 1. Create `supabase/functions/sync-data/index.ts`
- Accepts POST requests with actions: `push`, `pull`, `check` (get remote timestamp)
- Requires a `sync_key` in the request body, used as the `sync_id` lookup
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- For `push`: upserts data into `app_sync` where `sync_id = sync_key`
- For `pull`: selects data from `app_sync` where `sync_id = sync_key`
- For `check`: returns only `updated_at` for the given `sync_id`

### 2. Update `src/services/appSyncService.ts`
- Replace all direct `supabase.from('app_sync')` calls with `fetch()` calls to the `sync-data` edge function
- Pass the sync key (currently `'chiptime-default'`) in each request
- Keep the same public API (`pushToCloud`, `pullFromCloud`, `getRemoteUpdatedAt`)

### 3. Keep RLS locked down
No database migration needed — the `USING (false)` policy stays, protecting data from direct REST access.

## Files to Change
1. **New**: `supabase/functions/sync-data/index.ts` — edge function proxy
2. **Edit**: `src/services/appSyncService.ts` — route all calls through the edge function


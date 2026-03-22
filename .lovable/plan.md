

# Fix: Secure the `app_sync` Table

## Problem

The `app_sync` table has RLS policies that allow **anyone** (including anonymous users) to SELECT, INSERT, and UPDATE **all rows**. This means any person can read all client data, access codes, and API keys stored in the JSONB `data` column.

## Approach

Route all `app_sync` access through an edge function that uses the service role key (same pattern already used for `client_portals` / `get-portal`). Then lock down the table with `USING (false)` RLS policies.

This keeps the existing sync-key-based architecture intact — no authentication required, no app logic changes beyond swapping direct Supabase calls for edge function calls.

## Changes

### 1. Create edge function `sync-data` (`supabase/functions/sync-data/index.ts`)

Handles three operations based on `action` parameter:
- **`push`**: Receives `{ sync_id, data }`, upserts to `app_sync` using service role key
- **`pull`**: Receives `{ sync_id }`, returns `{ data, updated_at }` or `null`
- **`check`**: Receives `{ sync_id }`, returns `{ updated_at }` only
- **`migrate`**: Receives `{ old_sync_id, new_sync_id }`, updates the row's sync_id

All operations require `sync_id` in the request body — the sync key acts as the authentication secret. No one can read/write data without knowing the key.

### 2. Lock down `app_sync` RLS (database migration)

```sql
DROP POLICY "Anyone can read app_sync" ON public.app_sync;
DROP POLICY "Anyone can insert app_sync" ON public.app_sync;
DROP POLICY "Anyone can update app_sync" ON public.app_sync;

CREATE POLICY "No direct access to app_sync" ON public.app_sync
  FOR ALL USING (false);
```

### 3. Update `src/services/appSyncService.ts`

Replace all 5 direct `supabase.from('app_sync')` calls with `supabase.functions.invoke('sync-data', ...)` calls. The sync_id is still sent in the request body. No other files change.

### 4. Add to `supabase/config.toml`

```toml
[functions.sync-data]
verify_jwt = false
```

## What stays the same
- Sync key generation, storage, and migration logic
- `useStorage.ts`, `useCloudSync.ts`, `SyncKeyPrompt.tsx` — untouched
- All UI components — untouched
- The sync key remains the "password" to access data, but now it's validated server-side instead of being a simple query filter on a public table




# Bidirectional Cloud Sync Between Mobile App and Desktop `/chip`

## Problem
The mobile app and desktop `/chip` dashboard both use `capacitorStorage` (Capacitor Preferences), which falls back to localStorage in the browser. Data is isolated per device — changes on mobile don't appear on desktop and vice versa.

## Approach
Store the full app state (clients, vehicles, tasks, settings) as a JSON blob in a Lovable Cloud table. Both the mobile app and desktop dashboard push on every save and pull on load. A unique `sync_id` (generated once, stored locally) scopes the data.

## Changes

### 1. Database Migration — Create `app_sync` table
```sql
CREATE TABLE public.app_sync (
  sync_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_sync ENABLE ROW LEVEL SECURITY;

-- Public read/write (no auth in this app, sync_id acts as access key)
CREATE POLICY "Anyone can read app_sync" ON public.app_sync FOR SELECT USING (true);
CREATE POLICY "Anyone can insert app_sync" ON public.app_sync FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update app_sync" ON public.app_sync FOR UPDATE USING (true);
```

### 2. New: `src/services/appSyncService.ts`
- `getSyncId()`: reads from localStorage, generates UUID if missing
- `pushToCloud(clients, vehicles, tasks, settings)`: upserts full state to `app_sync` table by `sync_id`
- `pullFromCloud()`: fetches data by `sync_id`, returns `{ clients, vehicles, tasks, settings }`
- `getRemoteUpdatedAt()`: returns the `updated_at` timestamp for conflict detection
- Uses the existing Supabase client

### 3. Update: `src/hooks/useStorage.ts`
- After every `setClients`, `setVehicles`, `setTasks`, `setSettings` call, debounce-push all data to cloud (5s delay to batch rapid changes)
- On initial load, compare local `updated_at` vs remote `updated_at`:
  - If remote is newer → pull from cloud and overwrite local
  - If local is newer → push to cloud
  - If no remote data exists → push local data as initial seed

### 4. Update: `src/pages/DesktopDashboard.tsx`
- On mount, trigger a cloud pull before rendering data (show loading state)
- Add a "Refresh" button in the header to manually re-pull from cloud
- Optionally subscribe to Supabase Realtime on the `app_sync` table for live updates

### 5. Update: `src/pages/Index.tsx`
- On mount (after migration), trigger cloud sync check (pull if remote is newer)

## Sync Flow
```text
Mobile App                    Cloud (app_sync table)                Desktop /chip
───────────                   ─────────────────────                 ─────────────
  save data ──push──────────▶  { sync_id, data, updated_at }
                                                                    ◀──pull── load page
                                                                    edit data ──push──▶
  open app ──pull if newer──◀  { sync_id, data, updated_at }
```

### Conflict Resolution
Simple "last write wins" using `updated_at`. No merge — the most recent full snapshot replaces older data. This is acceptable because mobile and desktop are typically not used simultaneously.

### Files Changed
- **New**: `src/services/appSyncService.ts`
- **Modified**: `src/hooks/useStorage.ts` (add cloud push/pull)
- **Modified**: `src/pages/DesktopDashboard.tsx` (pull on mount, refresh button)
- **Modified**: `src/pages/Index.tsx` (sync check on mount)
- **Database**: New `app_sync` table


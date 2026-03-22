

# Fix: Move Sync Key from localStorage to Capacitor Preferences

## Problem
The sync key and `local_updated_at` are stored in `localStorage`, but all app data (clients, vehicles, tasks) is stored in Capacitor Preferences. On the native mobile app, `localStorage` and Capacitor Preferences are separate stores, so the native app generates/reads a different sync key than expected, causing it to write to a different cloud row than the browser.

## Solution
Move sync key and local_updated_at into Capacitor Preferences (same store as everything else). Make the affected methods async. Migrate existing localStorage values on first run so no one loses their key.

## Changes

### 1. `src/services/appSyncService.ts`
- Replace all `localStorage.getItem/setItem` calls with `Preferences.get/set`
- Make `getSyncId()`, `setSyncId()`, `hasSyncKey()`, `getLocalUpdatedAt()`, `setLocalUpdatedAt()` all **async**
- Add one-time migration: on first async call, check if localStorage has a key but Preferences doesn't — if so, copy it over
- Update `migrateFromFixedId` to use async getters
- Update `pushToCloud`, `pullFromCloud`, `getRemoteUpdatedAt` to await the sync key

### 2. All callers of appSyncService sync key methods — update to await
- `src/hooks/useStorage.ts` — `debouncedPushToCloud`, `pushNow`, `useCloudSync` already async, just add awaits
- `src/components/SyncKeySection.tsx` — load key with useEffect + async call
- `src/components/SyncKeyPrompt.tsx` — await `setSyncId()`

### 3. No changes to desktop behavior
- No auto-refresh, no polling, no restrictions. Everything else stays exactly as-is.

## Technical Detail
- Capacitor Preferences key: `chiptime_sync_key` (same name)
- Capacitor Preferences key: `app_sync_local_updated_at` (same name)  
- Migration: `if Preferences empty && localStorage has value → copy to Preferences, remove from localStorage`


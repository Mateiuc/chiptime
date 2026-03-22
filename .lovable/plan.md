

# Fix: Desktop Not Seeing Mobile Updates

## Problem
Desktop doesn't auto-refresh when mobile pushes changes. The sync key is stored in `localStorage` which the native mobile app may not share with the browser. Desktop keeps showing stale data until manually reloaded.

## Solution
Keep desktop fully read/write (no restrictions). Fix the two root causes:
1. **Sync key storage mismatch** — move sync key into Capacitor Preferences so native app and browser use the same key
2. **No auto-refresh on desktop** — add polling + visibility-based refresh so desktop picks up mobile changes automatically

## Changes

### 1. `src/services/appSyncService.ts` — Unified sync key storage
- Move `sync_key` and `local_updated_at` from `localStorage` to Capacitor Preferences (same store as task/client data)
- Make `getSyncId()` and related methods async since Preferences is async
- Keep one-time migration from old `localStorage` values so existing users don't lose their key
- This ensures the installed mobile app and any browser on the same device share the same sync key

### 2. `src/hooks/useStorage.ts` — Auto-refresh for desktop
- Add a 30-second polling interval that checks `getRemoteUpdatedAt()`
- If cloud timestamp is newer than local, auto-pull and apply
- Also refresh on `visibilitychange` (tab focus) so switching to desktop tab immediately syncs
- Keep all existing write/push behavior unchanged — both mobile and desktop can still read and write

### 3. `src/components/SyncKeySection.tsx` — Minor update
- Update to work with async `getSyncId()`
- No functionality removed

### 4. `src/components/SyncKeyPrompt.tsx` — Minor update
- Update to work with async `setSyncId()`

### 5. All other callers of `appSyncService.getSyncId()` / `setSyncId()`
- Update to handle async — mainly `useCloudSync` in `useStorage.ts` and `debouncedPushToCloud`

## What stays the same
- Desktop remains fully read/write — all session controls, Save to Cloud, everything stays
- Mobile remains fully read/write
- Last-write-wins conflict resolution unchanged
- Empty snapshot guard unchanged

## Files to Change
1. `src/services/appSyncService.ts` — async Preferences-based key storage
2. `src/hooks/useStorage.ts` — add auto-refresh polling + visibility listener
3. `src/components/SyncKeySection.tsx` — async getSyncId
4. `src/components/SyncKeyPrompt.tsx` — async setSyncId


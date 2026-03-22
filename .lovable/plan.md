

# Secure app_sync with Secret Sync Key

## Problem
The `app_sync` table uses a hardcoded `sync_id` ('chiptime-default') visible in source code, combined with fully open RLS policies (`USING (true)`). Anyone can read or overwrite all business data.

## Solution
Replace the hardcoded sync ID with a cryptographically random 32-character key generated on first use and stored locally. The key acts as a shared secret between devices. Users can view/copy it in Settings to link a second device.

**Note:** Without full authentication, RLS policies cannot truly restrict access by user identity. The security improvement comes from making the sync_id a 128-bit unguessable secret rather than a publicly known string. This is a pragmatic trade-off matching the user's preference.

## Changes

### 1. Migration: Clean up old data row
- Rename the existing `chiptime-default` row's sync_id to a new random value via a one-time migration (or leave it — the app will create a new row with the new key)
- No schema changes needed; `sync_id` column already supports arbitrary text

### 2. `src/services/appSyncService.ts`
- Remove `FIXED_SYNC_ID` constant
- Add `SYNC_KEY_STORAGE_KEY = 'chiptime_sync_key'`
- `getSyncId()` → reads from `localStorage`. If not found, generates a 32-char hex key using `crypto.getRandomValues()`, saves it, and returns it
- Add `setSyncId(key: string)` for manual entry from another device
- Add `hasSyncKey(): boolean` helper
- On first launch with no key: check if old `chiptime-default` row exists. If so, generate new key, update the row's `sync_id` to the new key, and store locally (one-time migration)

### 3. `src/components/DesktopSettingsView.tsx`
- Add a "Sync Key" section at the bottom of settings:
  - Display the current key (masked by default, with show/copy toggle)
  - "Link Another Device" input field to paste a key from another device
  - Warning text explaining the key is needed to sync across devices

### 4. `src/pages/Index.tsx` (mobile settings)
- Add the same sync key display/entry UI in the mobile settings dialog

## Files to Change
1. `src/services/appSyncService.ts` — replace hardcoded sync_id with generated secret key
2. `src/components/DesktopSettingsView.tsx` — add sync key management UI
3. `src/pages/Index.tsx` or `src/components/SettingsDialog.tsx` — add sync key UI for mobile


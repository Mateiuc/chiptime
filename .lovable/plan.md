

# Simplify: Single Cloud Data Row, No Sharing

## Problem
The current system generates a random `sync_id` per device, requiring a sharing mechanism to link them. The share link doesn't work and adds unnecessary complexity.

## Solution
Use a **fixed, deterministic sync_id** (hardcoded constant) so every device — mobile and desktop — reads/writes the same cloud row automatically. No sharing, no linking, no URL params.

### Changes

**1. `src/services/appSyncService.ts`**
- Replace `getSyncId()` logic: instead of generating a random UUID, use a fixed constant like `"chiptime-default"` 
- Remove `setSyncId()` method (no longer needed)
- Keep `pushToCloud` and `pullFromCloud` as-is

**2. `src/pages/DesktopDashboard.tsx`**
- Remove the `?sync=` URL param detection logic (lines 48-61)
- Remove `useSearchParams` import
- Keep "Save to Cloud" and "Reload" buttons — that's it

**3. `src/components/SettingsDialog.tsx`**
- Remove the "Share Desktop Link" button and all related code
- Clean up unused imports (`Share2`, `Copy`, `appSyncService`)

**4. `src/hooks/useStorage.ts`** — No changes needed, already correct

### Result
- Mobile saves to cloud automatically (debounced) ✓
- Desktop loads from cloud on start ✓  
- Desktop has manual Save/Reload buttons ✓
- Zero configuration between devices — just works


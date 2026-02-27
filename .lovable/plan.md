

# Rethink: Cloud as Source of Truth

## Current Problem
The current architecture stores data locally (Capacitor Preferences) and syncs snapshots to cloud. Both devices maintain independent local copies, leading to sync ID confusion and stale data.

## New Architecture

**Cloud = single source of truth.** No local caching of app data (except for offline fallback on mobile).

### Mobile (Master)
- Reads from cloud on start
- Every save writes directly to cloud (debounced)
- Export/Import = local file backup only (existing BackupView already handles this)
- Keeps local Capacitor Preferences as offline fallback only

### Desktop (Read + Manual Save)
- Loads from cloud on start (no local persistence needed)
- Edits stay in React state only
- "Save to Cloud" button pushes current state
- "Reload" button re-pulls from cloud

## Changes

### 1. `src/hooks/useStorage.ts` — Simplify cloud sync
- Remove the `latestSnapshot` accumulation pattern
- Mobile: after every `setClients/setVehicles/setTasks/setSettings`, immediately build a full snapshot from Capacitor storage and push (debounced 3s)
- Desktop: `pushNow()` reads current React state directly instead of relying on accumulated snapshot
- `useCloudSync` pull-on-mount stays the same

### 2. `src/pages/Index.tsx` — Mobile pulls cloud on start
- Add `useCloudSync` hook (currently missing — mobile doesn't pull from cloud)
- On mount: if remote is newer, pull and replace local data
- This ensures mobile always starts with latest cloud data

### 3. `src/pages/DesktopDashboard.tsx` — Simplify
- Remove sync ID linking UI (will use URL param approach instead)
- Keep "Save to Cloud" and "Reload" buttons
- On mount: auto-pull from cloud, no local persistence

### 4. `src/components/SettingsDialog.tsx` — Share link
- Replace raw sync ID display with a "Share Desktop Link" button
- Generates URL: `{origin}/chip?sync={syncId}`
- Uses Capacitor Share plugin (clipboard fallback)

### 5. `src/pages/DesktopDashboard.tsx` — Auto-link via URL
- Read `?sync=` query param on mount
- If present, set sync ID and pull — zero manual input needed
- Clean URL after consuming param

### Files Changed
- `src/hooks/useStorage.ts` — simplify push logic, add cloud pull to mobile
- `src/pages/Index.tsx` — add `useCloudSync` for pull-on-start
- `src/pages/DesktopDashboard.tsx` — URL-based sync ID, remove manual input
- `src/components/SettingsDialog.tsx` — share desktop link button


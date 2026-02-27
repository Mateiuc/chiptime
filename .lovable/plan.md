

# Simplify Sync: Mobile = Master, Desktop = Read + Manual Save

## Current Problem
Both mobile and desktop auto-push to cloud on every change. This creates conflicts and makes it unclear which device "owns" the data.

## New Behavior
- **Mobile (Index.tsx)**: Remains the master. Auto-pushes to cloud on every save (already works via debounced push in `useStorage.ts`).
- **Desktop (/chip)**: Pulls from cloud on load. Edits are local-only until the user clicks a **Save to Cloud** button. No auto-push.

## Changes

### 1. `src/hooks/useStorage.ts`
- Add a `pushEnabled` flag to `debouncedPushToCloud` so desktop can disable auto-push
- Export a `setCloudPushEnabled(boolean)` function
- Desktop calls `setCloudPushEnabled(false)` on mount
- Mobile keeps default behavior (push enabled)
- Add an explicit `pushNow()` export that forces an immediate push of `latestSnapshot`

### 2. `src/pages/DesktopDashboard.tsx`
- On mount: disable auto-push, then pull from cloud
- Replace the "Sync" button with **"Save to Cloud"** button that calls `pushNow()` to upload current desktop state
- Add a **"Reload from Cloud"** button to re-pull latest data from mobile
- Show last sync timestamp

### 3. `src/pages/Index.tsx`
- Ensure auto-push stays enabled (default behavior, no change needed)
- On mount: still check if remote is newer and pull if so (existing behavior)


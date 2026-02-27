

# Fix: Desktop Always Loads Cloud Data

## Problem
1. The `useCloudSync` hook on mount checks timestamps — if the browser previously synced (even with empty data), it thinks it's current and skips pulling
2. When running in the browser with no local data, the "seed" logic can push empty arrays to the cloud, wiping real data

## Changes

### 1. `src/hooks/useStorage.ts` — Fix syncOnMount
- **Don't seed empty data**: In the `!remoteTs` branch, only push if local storage actually has clients or tasks (skip if all empty)
- **Skip timestamp check on desktop**: When `cloudPushEnabled === false` (desktop mode), always pull regardless of timestamps — desktop has no meaningful local data to compare

### 2. `src/pages/DesktopDashboard.tsx` — Force pull on mount
- Add a `useEffect` that calls `refresh()` after the cloud sync hook initializes, ensuring the desktop always fetches the latest cloud state on page load
- This runs after `setCloudPushEnabled(false)` so it won't trigger an auto-push

### Files Changed
- `src/hooks/useStorage.ts` — guard empty seeds, always pull when push is disabled
- `src/pages/DesktopDashboard.tsx` — explicit refresh on mount


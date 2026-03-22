

# Fix: Cross-Device Sync Key Discovery

## Problem
Each device (mobile browser, desktop browser) generates its own independent sync key on first use. The user ends up with two different keys pointing to two separate data rows in the cloud, with no easy way to know which one has their real data. The desktop doesn't show mobile data because it's reading a different key.

## Solution
Add a **first-time setup prompt** on the desktop dashboard when it loads with an empty dataset, asking the user to either paste their mobile sync key or start fresh. Also improve the sync key section to show whether the current key has cloud data.

### 1. Create `SyncKeyPrompt` component
A modal/dialog shown on desktop when:
- Cloud pull returns no data (empty clients + tasks), AND
- The device's sync key was auto-generated (no manual entry yet)

The prompt offers two options:
- **"I have a sync key"** → paste field for the key from mobile → applies it and reloads
- **"Start fresh"** → dismisses the prompt, keeps the current key

### 2. Update `DesktopDashboard.tsx`
- After initial `useCloudSync` pull completes, check if data is empty
- If empty, show the `SyncKeyPrompt` overlay
- On key entry, call `appSyncService.setSyncId()` then `refresh()`

### 3. Update `SyncKeySection.tsx`
- Add a small status indicator: "✓ Cloud data found" or "No data for this key" based on a quick check of `getRemoteUpdatedAt()`
- This helps the user on mobile know which key has their data

### 4. No backend changes needed
The existing `app_sync` table and RLS policies work as-is.

## Files to Change
1. `src/components/SyncKeyPrompt.tsx` — new first-time setup dialog
2. `src/pages/DesktopDashboard.tsx` — show prompt when data is empty after sync
3. `src/components/SyncKeySection.tsx` — add cloud data status indicator




# Problem: Desktop Has No Data

## Root Cause
Each device generates its own random `sync_id` (stored in `localStorage` as `app_sync_id`). The phone and desktop browser have **different** `sync_id` values, so they read/write to **separate rows** in the cloud database. The desktop pulls data for its own sync_id and finds nothing.

## Secondary Issue
The RLS policies on `app_sync` are all marked as **RESTRICTIVE** instead of **PERMISSIVE**. While this currently works because each command has only one policy evaluating to `true`, it should be fixed for correctness.

## Fix

### 1. Add Sync ID display + input to Settings (mobile)
In `src/components/SettingsDialog.tsx`:
- Show the current `sync_id` with a **Copy** button so the user can share it with the desktop

### 2. Add Sync ID input to Desktop Dashboard
In `src/pages/DesktopDashboard.tsx`:
- Add a small input/button in the header to **enter a sync_id** from the phone
- When entered, call `appSyncService.setSyncId(id)` and immediately pull from cloud
- Show the current sync_id for reference

### 3. Fix RLS policies
Change the three `app_sync` policies from RESTRICTIVE to PERMISSIVE so they work correctly.

### Files Changed
- `src/components/SettingsDialog.tsx` — add sync_id display + copy button
- `src/pages/DesktopDashboard.tsx` — add sync_id input field
- Database migration — fix RLS policy permissiveness


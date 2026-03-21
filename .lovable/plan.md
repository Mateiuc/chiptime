

# Centralize PIN Generation in the Cloud

## Problem
Every place that needs an access code calls `generateAccessCode()` locally, meaning mobile and desktop can each generate a **different** PIN for the same client if neither has synced yet. The PIN must be generated once and stored in the cloud as the single source of truth.

## Solution

### 1. `syncPortalToCloud` generates the PIN if missing
In `src/lib/clientPortalUtils.ts`, modify `syncPortalToCloud`:
- If `client.accessCode` is empty/null, generate the code **inside this function** before sending it to the cloud.
- **Return both** `portalId` and `accessCode` from the function so callers can persist it locally.

### 2. `sync-portal` edge function returns the access code
In `supabase/functions/sync-portal/index.ts`, include `access_code` in the response JSON so the caller always gets the canonical PIN back.

### 3. Remove all local `generateAccessCode()` calls from UI components
In all call sites (`DesktopDashboard.tsx`, `ManageClientsDialog.tsx`, `DesktopClientsView.tsx`):
- Stop calling `generateAccessCode()` before sync.
- Instead, call `syncPortalToCloud(client, ...)` which handles PIN generation internally.
- Use the returned `accessCode` to update the local client.
- For "Show PIN" buttons: if `client.accessCode` exists, show it. If not, trigger a sync first to generate one.

### Files to change
1. `src/lib/clientPortalUtils.ts` — move PIN generation into `syncPortalToCloud`, return `{ portalId, accessCode }`
2. `supabase/functions/sync-portal/index.ts` — return `access_code` in response
3. `src/pages/DesktopDashboard.tsx` — use returned accessCode from sync
4. `src/components/ManageClientsDialog.tsx` — same
5. `src/components/DesktopClientsView.tsx` — same


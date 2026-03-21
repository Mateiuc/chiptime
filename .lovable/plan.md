

# Fix Client Portal PIN Issues

## Problems

1. **PIN not accepted**: The access code stored in `client.accessCode` is synced to the cloud via `syncPortalToCloud`. However, when the mechanic previews the portal, the cloud data might have a stale or different access code than what was set locally. The PIN verification uses `fetchPortalFromCloud` which returns the `access_code` from the database — if it doesn't match what the user enters, it fails.

2. **Preview should skip PIN**: When the mechanic clicks "Preview Portal" (the Eye button), they shouldn't need to enter a PIN — they're the owner. Only shared links should require the PIN.

3. **Both mobile and desktop should use the same PIN per client**: The access code is already stored per-client in `client.accessCode`. The issue is that some code paths generate a *new* code on share but don't always persist it back to the client, or the preview button opens the portal without re-syncing the latest code.

## Solution

Add a `preview=1` query parameter when the mechanic opens the portal. In `ClientPortal.tsx`, if `preview=1` is present, skip the PIN screen entirely. For shared links (no `preview` param), keep the PIN gate as-is.

Also ensure the preview button always re-syncs before opening (some paths skip sync if `portalId` already exists).

## Changes

### 1. `src/pages/ClientPortal.tsx`
- Read `searchParams.get('preview')` — if truthy, set `verified = true` immediately (skip PIN)

### 2. `src/pages/DesktopDashboard.tsx` (preview buttons)
- Line ~1160-1169: The Eye button only syncs if `portalId` is missing. Change to **always re-sync** before opening, so the latest access code and data are pushed. Add `?preview=1` to the URL.
- Line ~1356: The client list portal button — add `?preview=1`

### 3. `src/components/TaskCard.tsx` (line ~1321)
- Add `?preview=1` to the portal URL

### 4. `src/components/ManageClientsDialog.tsx` (line ~658)
- Add `?preview=1` to the portal URL
- Ensure re-sync before opening

### Files
1. `src/pages/ClientPortal.tsx`
2. `src/pages/DesktopDashboard.tsx`
3. `src/components/TaskCard.tsx`
4. `src/components/ManageClientsDialog.tsx`


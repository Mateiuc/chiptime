

# Consolidate Client Portal to Single Cloud Route

## Problem
There are **two different portal routes** producing different views:

1. **`/client/:clientId`** — reads from **local storage** on the mechanic's device. Shows full data (including diagnostic PDFs) because it computes everything fresh from local data.
2. **`/client-view?id=xxx`** — reads from **cloud**. Shows whatever was synced at the time — if synced before recent features (diagnostic PDF, photos), those are missing.

Additionally, `DesktopDashboard.tsx` line 1356 uses `/client/${client.portalId}` which hits the `/client/:clientId` route with a portal ID instead of a client UUID — this would **fail** to find the client in local storage.

## Root Cause
The `/client/:clientId` route is a legacy on-device-only path. It only works on the mechanic's browser. When the mechanic clicks "Client Portal" from the desktop dashboard, it opens this broken route. Meanwhile, the "Share Link" button correctly generates `/client-view?id=PORTAL_ID`.

## Solution
1. **Remove the `/client/:clientId` route entirely** — it's unreliable and redundant
2. **Fix all portal open/preview buttons** to use the cloud route (`/client-view?id=PORTAL_ID`), re-syncing data first to ensure it's current
3. **Ensure re-sync before preview** so diagnostic PDFs and other recent data are always included in the cloud snapshot

## Changes

### 1. `src/App.tsx` — Remove legacy route
Remove the `/client/:clientId` route. Keep only `/client-view`.

### 2. `src/pages/ClientPortal.tsx` — Remove on-device mode
Remove the `clientId` param handling and local storage loading branch. The portal now only supports cloud mode (`?id=xxx`) and shared hash mode (`#data`).

### 3. `src/pages/DesktopDashboard.tsx` — Fix portal button (line 1356)
Change `window.open('/client/${client.portalId}', '_blank')` to use `${PORTAL_BASE_URL}/client-view?id=${client.portalId}`. Also re-sync portal data before opening so the latest diagnostic PDFs are included.

### 4. `src/components/TaskCard.tsx` — Fix portal navigation (line 1318)
Change `navigate('/client/${client.id}')` to open `${PORTAL_BASE_URL}/client-view?id=${client.portalId}` in a new tab. If no `portalId` exists, sync first, then open.

### 5. `src/components/ManageClientsDialog.tsx` — Fix portal button (line 658)
Change `navigate('/client/${client.id}')` to open cloud portal URL instead.

## Files to edit
1. `src/App.tsx`
2. `src/pages/ClientPortal.tsx`
3. `src/pages/DesktopDashboard.tsx`
4. `src/components/TaskCard.tsx`
5. `src/components/ManageClientsDialog.tsx`


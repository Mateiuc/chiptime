

# Fix Client Portal Preview Button

## Problem
The **Eye (Client Portal)** button opens `/client/${client.portalId || client.id}` in a new tab. This route loads data from **local storage** (`capacitorStorage`), which doesn't work in a desktop browser tab opened via `window.open`. The Share Link button works because it uses the cloud URL (`/client-view?id=${portalId}`).

## Fix — `src/pages/DesktopDashboard.tsx` (line 883)

Change the Eye button to:
1. If the client has a `portalId`, open the cloud portal URL: `${PORTAL_BASE_URL}/client-view?id=${portalId}`
2. If no `portalId` exists, sync to cloud first (same as Share does), then open the resulting URL

This makes the Eye button a "preview" that opens the same cloud portal the client would see, rather than trying to load from local storage which doesn't exist in a new browser tab.

## Files Changed
- `src/pages/DesktopDashboard.tsx` — update Eye button onClick handler


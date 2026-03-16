

# Add Missing Mobile Action Buttons to Desktop Client Tree View

## Problem
The desktop tree view client header (line 670-704 in `DesktopDashboard.tsx`) is missing 3 action buttons that the mobile `ManageClientsDialog` has:
- **Print PDF** — generates a client report PDF
- **PIN** — generates/shows the client access code
- **Share Link** — syncs portal to cloud and copies URL (with fallback to file download)

Also, the **Portal** button is only shown conditionally (`client.portalId && ...`) — mobile always shows it.

## Changes — `src/pages/DesktopDashboard.tsx`

### 1. Add missing icon imports (line 2)
Add `Printer`, `KeyRound`, `Link2`, `Eye` to the lucide import.

### 2. Add missing util imports (line 19)
Add `generateAccessCode`, `calculateClientCosts`, `encodeClientData`, `generatePortalHtmlFile`, `PORTAL_BASE_URL` to the clientPortalUtils import (some already imported).

### 3. Add `generateClientPDF` function
Copy the same PDF generation function from `ManageClientsDialog` (lines 189-350). It uses `jsPDF` (already imported), `getClientVehicles`, `getClientFinancials`, `formatCurrency`, `formatDuration` — all already available in DesktopDashboard.

### 4. Add 3 buttons + fix Portal visibility (lines 696-700)
Insert before the Delete button:
- **Print PDF** button — calls `generateClientPDF(client.id)`
- **PIN** button — same logic as mobile: generate or show `accessCode`, save via `updateClient`
- **Share Link** button — same logic as mobile (lines 630-711): cloud sync first, fallback to hash/file
- **Portal** button — remove the `client.portalId &&` condition so it's always visible

All buttons use `variant="ghost" size="icon"` to match desktop icon-button style.

## Files Changed
- `src/pages/DesktopDashboard.tsx`


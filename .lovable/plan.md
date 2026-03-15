

# Add "Import Previous Work" Button to Desktop Clients View

## Problem

The "Import XLS Work History" button exists in the **tree view** (DesktopDashboard.tsx, line 678) but is **missing** from `DesktopClientsView.tsx` — the dedicated client management panel. When users manage clients from that view, the import button is not available.

## Fix

### 1. Add `onImportXls` prop to `DesktopClientsView`

Add a new prop `onImportXls: (file: File, clientId: string) => void` to `DesktopClientsViewProps`.

### 2. Add Upload button + hidden file input in the client detail panel

In the client action buttons area of `DesktopClientsView.tsx`, add:
- An `Upload` icon button (same style as tree view)
- A hidden `<input type="file" accept=".xls,.xlsx">` that triggers `onImportXls`

### 3. Wire it up in `DesktopDashboard.tsx`

Pass the existing `handleImportXls` function to the `DesktopClientsView` component as the `onImportXls` prop.

## Files Changed
- `src/components/DesktopClientsView.tsx` — add prop, Upload button, hidden file input
- `src/pages/DesktopDashboard.tsx` — pass `onImportXls` prop


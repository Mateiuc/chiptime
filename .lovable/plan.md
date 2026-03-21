

# Fix Portal Preview Button in Desktop Clients View

## Problem
The "Portal" button in `DesktopClientsView.tsx` (line 296) navigates to `/client/${selectedClient.id}`, which is a non-existent route causing a 404. It should open the cloud portal URL like the other views do.

## Fix

### `src/components/DesktopClientsView.tsx` (line 296)
Replace the broken `navigate()` call with `window.open()` using the correct portal URL pattern, matching the behavior in `DesktopDashboard.tsx` and `ManageClientsDialog.tsx`:

```text
// Before:
navigate(`/client/${selectedClient.id}`)

// After:
Force sync to cloud first, then open:
window.open(`${PORTAL_BASE_URL}/client-view?id=${portalId}&preview=1`, '_blank')
```

Also need to:
- Import `PORTAL_BASE_URL` and `syncPortalToCloud` (check if already imported)
- Add async logic to sync portal before opening preview (same pattern as the Eye button in DesktopDashboard tree view)
- Disable the button if no portal data exists yet, or auto-sync on click


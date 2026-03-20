

# Add "Manage Clients" Button to Desktop Dashboard

## What
Wire the existing `DesktopClientsView` component into the desktop dashboard as a new view mode, accessible via a "Manage Clients" button in the header. No Start Work / restart work buttons — those remain mobile-only.

## Changes

### 1. `src/pages/DesktopDashboard.tsx`
- Expand view type: `'tree' | 'settings' | 'reports' | 'invoices' | 'clients'`
- Import `DesktopClientsView` and `Users` icon
- Add a "Manage Clients" toggle button in the header (same style as existing report/settings/invoice buttons)
- Add rendering branch: when `desktopView === 'clients'`, render `<DesktopClientsView>` with all needed props (clients, vehicles, tasks, settings, onUpdateClient, onDeleteClient, onUpdateVehicle, onDeleteVehicle, onMoveVehicle)

### 2. No other files changed
`DesktopClientsView` already exists with full functionality and already excludes Start Work buttons.


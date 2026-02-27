

# Desktop: Remove +Vehicle, Desktop-Native Settings & Clients Views

## Changes — `src/pages/DesktopDashboard.tsx`

### 1. Remove "+Vehicle" button
- Remove the `<Button>` with `Plus` icon and "Vehicle" text from the header (line 522-524)
- Remove `showAddVehicle` state, `AddVehicleDialog` import and usage, and `handleAddVehicle` handler (vehicles are added from mobile only)

### 2. Replace dialog-based menus with inline desktop views
- Add a `desktopView` state: `'tasks' | 'clients' | 'settings'` (default `'tasks'`)
- Header buttons for "Clients" and Settings gear switch `desktopView` instead of opening dialogs
- When `desktopView` is not `'tasks'`, render the corresponding content in the main area instead of the table tabs

### 3. Inline Clients Management view
- When `desktopView === 'clients'`, render a desktop-friendly client management panel directly in `<main>`:
  - Two-column layout: client list on left, selected client details on right
  - Client details include: editable name/email/phone/hourlyRate fields, vehicle list with edit/delete, PDF report button, portal link, move vehicle
  - Reuse existing handler functions (`handleUpdateClient`, `handleDeleteClient`, etc.)
  - Remove `ManageClientsDialog` import and usage

### 4. Inline Settings view  
- When `desktopView === 'settings'`, render settings form directly in `<main>`:
  - Card-based layout with sections: Hourly Rate, Notifications toggle, OCR Provider + API keys, Data Management (Export/Import XML, Backup & Restore)
  - Reuse existing settings state and save logic from `SettingsDialog`
  - Remove `SettingsDialog` import and usage

### 5. Header updates
- "Clients" button toggles `desktopView` to `'clients'` (highlighted when active)
- Settings gear toggles `desktopView` to `'settings'` (highlighted when active)  
- Clicking either again (or a "Back" action) returns to `'tasks'`

### Files changed
- `src/pages/DesktopDashboard.tsx` — remove +Vehicle, replace dialog triggers with inline view switching, add desktop client management and settings panels




# Desktop Dashboard at `/chip` Route

## Overview
Create a new `/chip` route that renders the same data (clients, vehicles, tasks, settings) in a desktop-friendly layout without the phone frame. No timer start/stop/pause functionality — only data viewing and editing (edit tasks, mark billed/paid, manage clients/vehicles, settings).

## Architecture

The `/chip` route will render a new `DesktopDashboard` page component that:
- Reuses existing hooks (`useClients`, `useVehicles`, `useTasks`, `useSettings`)
- Reuses existing components (`TaskCard`, `EditTaskDialog`, `SettingsDialog`, `ManageClientsDialog`, `AddVehicleDialog`, `AddClientDialog`)
- Removes timer controls (start, pause, stop, auto-pause logic)
- Uses a wide desktop layout with sidebar or multi-column design

## Files

### 1. New: `src/pages/DesktopDashboard.tsx`
- Full-width layout (no phone frame), responsive for PC browsers
- Sidebar with client list + search/filter
- Main content area showing tasks grouped by client, with tabs (Active / Completed / Billed / Paid)
- Header with settings gear, add vehicle/client buttons
- All CRUD: edit tasks, mark billed/paid, delete, manage clients/vehicles
- No `handleStartTimer`, `handlePauseTimer`, `handleStopTimer`, `handleCompleteWork` — removes all timer logic
- Keep: `handleMarkBilled`, `handleMarkPaid`, `handleDelete`, `handleAddClient`, `handleAddVehicle`, `handleUpdateClient`, `handleDeleteClient`, `handleUpdateVehicle`, `handleDeleteVehicle`, `handleMoveVehicle`, `handleRestartTimer` (for resuming completed tasks back to active)
- TaskCard rendered without `onPauseTimer`/`onStopTimer` props (hides timer buttons)

### 2. Update: `src/App.tsx`
- Add route: `<Route path="/chip" element={<DesktopDashboard />} />` alongside the portal routes (outside phone frame)

### Layout Design
```text
┌──────────────────────────────────────────────────┐
│  Header: Auto-Tracker Desktop  [+Vehicle] [⚙]   │
├────────────┬─────────────────────────────────────┤
│  Clients   │  Tasks for Selected Client          │
│  ────────  │  [Active] [Completed] [Billed] [Paid]│
│  • Client1 │                                     │
│  • Client2 │  TaskCard  TaskCard  TaskCard        │
│  • Client3 │  TaskCard  TaskCard                  │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

- Left sidebar: scrollable client list with vehicle count, click to filter
- Main area: task cards in a responsive grid (2-3 columns on wide screens)
- All 4 status tabs: Active, Completed, Billed, Paid
- "All Clients" option to see everything

### Key Differences from Mobile Index
- No phone frame wrapper
- No timer start/pause/stop buttons on cards
- No `CompleteWorkDialog`
- Multi-column grid layout for task cards
- Sidebar for client navigation
- All status tabs visible (not just Active/Completed)


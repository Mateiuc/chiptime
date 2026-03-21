

# Redesign Desktop Dashboard Layout

## Problem
The current tree view stretches full-width across the screen. On wide monitors, client/vehicle rows span ~1400px+ with action buttons pushed far right, creating large gaps of unused space. The filter buttons (All, Active, Completed, Billed, Paid) sit in a thin bar at the top.

## Proposed New Layout: Sidebar + Content Panel

Replace the current full-width tree with a **two-panel layout**:

```text
┌──────────────────────────────────────────────────────┐
│  Header (stays the same)                             │
├─────────────┬────────────────────────────────────────┤
│  LEFT PANEL │  RIGHT PANEL                           │
│  (280px)    │  (flex-1)                              │
│             │                                        │
│  ┌────────┐ │  Selected Client: "Lance Naidoo"       │
│  │ ALL 29 │ │  ┌──────────────────────────────────┐  │
│  ├────────┤ │  │ 2006 BMW 330i  VIN:...  $762     │  │
│  │🟢 0    │ │  │  Task 1 - completed - 2:30       │  │
│  │✅ 11   │ │  │  Task 2 - billed - 1:15          │  │
│  │📋 2    │ │  ├──────────────────────────────────┤  │
│  │💰 16   │ │  │ 2023 JEEP Grand Cherokee  $549   │  │
│  ├────────┤ │  │  Task 1 - paid - 3:00            │  │
│  │        │ │  └──────────────────────────────────┘  │
│  │ Client │ │                                        │
│  │  list  │ │  Summary stats / chart at bottom       │
│  │  with  │ │                                        │
│  │ counts │ │                                        │
│  │        │ │                                        │
│  └────────┘ │                                        │
└─────────────┴────────────────────────────────────────┘
```

### Left Panel
- **Status filter tabs** stacked vertically at the top (All, Active, Completed, Billed, Paid) with counts — styled as colored pills/cards, not plain buttons
- **Client list** below — compact cards showing client name, vehicle count, task count, and total revenue for current filter
- Clicking a client selects it and shows its details in the right panel
- Search bar at top of the list
- Selected client highlighted with accent color

### Right Panel
- **Client header** with name, contact info, rate, and action buttons (edit, add vehicle, print, portal, etc.)
- **Vehicle cards** below — each as a contained card with vehicle info, cost, and expandable task list
- Tasks shown with status badges, time, cost, and action buttons
- Expected Gain table and Revenue charts appear at the bottom of the right panel (contextual to filter)
- When no client is selected: show an overview summary with all clients' stats in a grid/card layout

### Visual Style Changes
- Status filters use colored indicator dots (green=active, blue=completed, purple=billed, emerald=paid)
- Vehicle cards use the existing color scheme but are more compact card-based instead of full-width rows
- Task rows use a clean table-like layout within each vehicle card
- Less horizontal stretching, more vertical stacking

## Files to Change

1. **`src/pages/DesktopDashboard.tsx`** (lines ~950-1650) — Restructure the tree view render section:
   - Move filter buttons from horizontal bar into left sidebar as vertical stack
   - Add client list panel on the left
   - Add selectedClientId state (reuse existing pattern from DesktopClientsView)
   - Right panel shows selected client's vehicles/tasks
   - When no client selected, show overview grid of all clients as summary cards

2. No new files needed — this is a layout restructure of the existing tree view within DesktopDashboard.

## What Stays the Same
- All existing functionality (edit, delete, bill, portal, etc.)
- Header bar with search, buttons, view toggles
- Other views (settings, reports, invoices, clients) unchanged
- Data model and state management unchanged
- Color schemes for vehicles and sessions


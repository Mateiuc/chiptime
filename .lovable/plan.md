

# Rebuild Desktop Dashboard — Full-Screen Colorful Tree View

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Header: gradient bg, title, search (w-80), cloud btns, gear   │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All] [Active] [Completed] [Billed] [Paid]  | stats  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Client "John" (gradient header, collapsible) ────────────┐ │
│  │  📧 email  📞 phone  💰 $85/hr   [Edit] [PDF] [Share]    │ │
│  │                                                            │ │
│  │  ┌─ 🚗 2024 BMW X5 (vehicle color bg) ──────────────────┐│ │
│  │  │  VIN: WBA... · Color: Black   [Edit] [Move] [Delete] ││ │
│  │  │                                                       ││ │
│  │  │  Session 1 · Jan 15 · 2h30m · $212  [Edit] [Bill]    ││ │
│  │  │    Period: 9:00→11:30                                 ││ │
│  │  │    Parts: Brake pads ×2 = $80                         ││ │
│  │  │                                                       ││ │
│  │  │  Session 2 · Jan 18 · 1h15m · $106  [Edit] [Bill]    ││ │
│  │  └───────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Revenue Charts (2-col grid) ─────────────────────────────┐ │
│  │  [Monthly Revenue BarChart]  [Cars by Month BarChart]      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Changes

### 1. `src/pages/DesktopDashboard.tsx` — Complete rewrite of the render section

**Keep**: All handler functions (lines 21-233), hooks, data loading, cloud sync logic. Only rewrite the JSX return (lines 430-570).

**New layout**:
- Full-screen `h-screen flex flex-col`, no sidebar
- **Header**: Colorful gradient (`bg-gradient-to-r from-primary via-primary/90 to-primary/80`) with white text, search input `w-80` (normal desktop width, not stretched), cloud buttons
- **Filter bar**: Sticky row of 5 toggle buttons (All / Active / Completed / Billed / Paid) with counts. Single state `filter: 'all' | 'active' | 'completed' | 'billed' | 'paid'`. Right side shows summary stats (total clients, vehicles, revenue)
- **Scrollable body**: Tree of collapsible client cards

**Client cards**:
- Collapsible. Header uses `getVehicleColorScheme(client.id).gradient` — full-width gradient bar with client name, contact info, rate, action buttons (Edit, PDF, Portal, Share, Delete)
- Expanded: shows their vehicles

**Vehicle cards** (nested inside client):
- Uses `getVehicleColorScheme(vehicle.id)` — `.card` bg + `.border` border
- Header: year make model, VIN, color, action buttons (Edit, Move, Delete)
- Contains matching sessions/tasks filtered by current status filter

**Session/Task rows** (nested inside vehicle):
- Uses `getSessionColorScheme(session.id)` colors
- Shows: session number, date, duration, cost, status badge, action buttons (Edit via EditTaskDialog, Mark Billed, Mark Paid, Reactivate, Delete)
- Below: period times + parts list in compact inline format

**Revenue charts** (at bottom, visible on Paid filter):
- Same recharts logic as ClientCostBreakdown — monthly revenue + cars by month bar charts
- 2-column grid, colorful card backgrounds

**Filtering logic**:
- `all`: show everything
- `active`: tasks with status pending/in-progress/paused
- `completed`: tasks with status completed
- `billed`: tasks with status billed
- `paid`: tasks with status paid
- Hide vehicles with 0 matching tasks, hide clients with 0 matching vehicles

**Desktop input sizing**: All inputs use normal `w-80` or natural width — never stretched full-width. Buttons at natural size.

### 2. `src/components/DesktopClientsView.tsx` — No longer imported
- Remove import from DesktopDashboard since client management is now inline in the tree

### 3. Settings
- Keep the settings gear button — clicking it renders `DesktopSettingsView` as an overlay or replaces the tree view (same as current behavior)

### Files changed
- `src/pages/DesktopDashboard.tsx` — rewrite JSX return, add filter state, add tree rendering logic, add revenue charts


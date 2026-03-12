

# Full Analytics & Reports Page for Desktop

## Overview
Create a new dedicated `/chip/reports` page (or a new view tab within the existing desktop dashboard) that provides comprehensive visual analytics with rich filtering. Since the app uses a single `DesktopDashboard` component with view switching (`tree` / `settings`), I'll add a third view mode: `reports`.

## New View: `reports` in DesktopDashboard

### Navigation
- Add a chart/reports icon button in the header bar (next to the settings gear) that toggles to the reports view.

### Filter Toolbar (top of reports view)
A sticky toolbar with:
- **Client filter**: dropdown to select a specific client or "All Clients"
- **Vehicle filter**: dropdown (filtered by selected client) or "All Vehicles"
- **Status toggles**: Completed / Billed / Paid toggle buttons (same pattern as existing)
- **Date range**: two date pickers (From / To) using the Shadcn Calendar/Popover pattern to scope all charts to a date window
- **Reset button**: clears all filters back to defaults

### Charts Section (scrollable grid below toolbar)
All charts use recharts (already installed). Each chart card uses a distinct color gradient border (like the existing paid/completed chart cards).

1. **Revenue Over Time** (bar chart, green gradient)
   - Monthly revenue bars, respects all filters
   - Click bar to see itemized breakdown (reuse drill-down table pattern)

2. **Revenue by Client** (horizontal bar chart, blue gradient)
   - One bar per client showing total revenue within filtered range
   - Different color per client bar using the vehicle color scheme

3. **Revenue by Vehicle** (horizontal bar chart, purple gradient)
   - Top 20 vehicles by revenue, with make/model labels
   - Each bar a different shade

4. **Tasks by Status** (pie/donut chart, amber gradient)
   - Shows count of tasks per status within filtered range
   - Each status gets its existing color from `statusColors`

5. **Work Hours Over Time** (line/area chart, cyan gradient)
   - Monthly total hours worked
   - Useful to see effort vs revenue

6. **Cars Serviced Over Time** (bar chart, indigo gradient)
   - Unique vehicles per month

### Detail Table (below charts)
- A full sortable table of all tasks matching the current filters
- Columns: Date, Client, Vehicle, Description, Status, Time Worked, Cost
- Sortable by Date, Cost, Client, Status
- Shows description inline
- Color-coded status badges
- Footer with totals

## Technical Approach

### Changes to `src/pages/DesktopDashboard.tsx`
1. Add `desktopView` option `'reports'` to the existing `'tree' | 'settings'` union
2. Add reports icon button in header
3. Add new state variables for report filters: `rptClient`, `rptVehicle`, `rptStatusCompleted/Billed/Paid`, `rptDateFrom`, `rptDateTo`, `rptSortField`, `rptSortDir`
4. Add `useMemo` hooks for each chart's data, all derived from `tasks` + filter state
5. Add the reports view JSX block (conditionally rendered when `desktopView === 'reports'`)

### New imports needed
- `PieChart, Pie, Cell, LineChart, Line, AreaChart, Area` from recharts
- `Calendar` component and `Popover` for date pickers
- `format` from `date-fns`
- `CalendarIcon, BarChart3` from lucide-react

### Color scheme for charts
Use a palette array for pie/bar segments:
```text
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#6366f1',
  '#14b8a6', '#f97316', '#84cc16', '#a855f7'
];
```

### File size consideration
The DesktopDashboard is already 1156 lines. To keep it manageable, I'll extract the reports view into a new component:
- **`src/components/DesktopReportsView.tsx`** — new file containing all reports logic, charts, filters, and table
- DesktopDashboard passes `tasks`, `clients`, `vehicles`, `settings`, and helper functions as props

This keeps the main dashboard clean and the reports self-contained.


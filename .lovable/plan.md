

# Drill-Down on "Money Over Time" Bar Chart

## Concept
When the user double-clicks a bar in the chart, the chart view swaps to show a detailed breakdown of that month — listing each vehicle with its cost. A "Back to chart" button returns to the bar graph view.

## Implementation (single file: `src/pages/DesktopDashboard.tsx`)

### 1. Add state for drilled month
- `const [drillMonth, setDrillMonth] = useState<string | null>(null)`

### 2. Compute drill-down data
- A `useMemo` that, when `drillMonth` is set, filters tasks to that month (and selected client), then groups them by vehicle, showing: vehicle make/model/year, VIN, client name, and total cost for that month.

### 3. Handle bar double-click
- Add `onDoubleClick` handler on the `<Bar>` component via the `onClick` event on `BarChart` (recharts supports `onClick` on `Bar` which fires on single click — we can use single click for simplicity since double-click isn't natively supported by recharts). Use `onClick` on the `<Bar>` component: `onClick={(data) => setDrillMonth(data.month)}`.

### 4. Swap chart with detail table
- When `drillMonth` is set, instead of the BarChart, render a table/list showing:
  - Header: "Details for {month}" + a "Back" button to clear `drillMonth`
  - Rows: each vehicle with client name, make/model/VIN, and cost for that month
  - Total row at the bottom
- Same container height (250px) with scroll if needed.


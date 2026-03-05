

# Add Status Filter Buttons to Main "Money Over Time" Bar Chart

## Changes in `src/pages/DesktopDashboard.tsx`

### 1. Add new state variables for chart-level status filters
Add `chartShowCompleted`, `chartShowBilled`, `chartShowPaid` — all default `true`. These are separate from the drill-down filters so they work independently.

### 2. Update `monthlyRevenueData` memo
Add status filtering before aggregation: skip tasks whose status doesn't match the enabled chart-level toggles. Add the three new state variables to the dependency array.

### 3. Add toggle buttons above the chart
Place three small toggle buttons (Completed / Billed / Paid) in a row between the existing client selector and the chart area — same style as the drill-down toggles (`variant={chartShowX ? 'default' : 'outline'}`, small size). Only visible when `!drillMonth` (main chart view).

### 4. Pass chart-level filters to drill-down
When clicking a bar to drill down, initialize `drillShowCompleted/Billed/Paid` from the chart-level filter values so the drill-down inherits the same visibility.


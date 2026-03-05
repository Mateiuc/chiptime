

# Add Vehicle Cost Display and Client Revenue Chart

## 1. Show total cost per vehicle on the vehicle header line

In the vehicle header row (line ~660-671), add the sum of all task costs for that vehicle on the right side, next to the VIN. This gives immediate visibility of how much each car is worth.

**Location**: `src/pages/DesktopDashboard.tsx`, vehicle header `div` (~line 661-671)
- Compute `vehicleCost = vehicleTasks.reduce((sum, t) => sum + getTaskCost(t), 0)`
- Display it as a bold formatted currency after the VIN/color badges, on the right side of the header

## 2. Add "Money Over Time" chart with client selector at bottom of page

Below the existing tree (after the Expected Gain / Revenue Charts sections, ~line 949), add a new section visible on **all** filters:

- A dropdown (`<select>` or `<Select>`) listing all clients plus an "All Clients" option
- A bar chart showing monthly revenue for the selected client (or all clients combined)
- Data sourced from all tasks (any status) grouped by month based on task creation date
- Uses the existing `recharts` imports already in the file

**Location**: `src/pages/DesktopDashboard.tsx`
- Add state: `const [chartClient, setChartClient] = useState<string>('all')`
- Add a `useMemo` to compute monthly data filtered by selected client
- Render a new card section with the client selector and bar chart at the bottom of the main content area

### Files to edit
- `src/pages/DesktopDashboard.tsx` only


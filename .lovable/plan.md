

# Add Description, Date, and Time Worked to Money Over Time Drill-Down

## Current State
The drill-down table groups tasks by vehicle and shows only 3 columns: Vehicle, Client, Cost.

## Proposed Change
Switch from vehicle-grouped rows to **per-task rows**, adding Description, Date, and Time Worked columns before Client.

### New column order:
`Vehicle | Description | Date | Time Worked | Client | Cost`

### Changes in `src/pages/DesktopDashboard.tsx`:

1. **Update `drillDownData` memo** (lines 429-451): Instead of grouping by vehicle, return one row per task with fields: `vehicle`, `client`, `cost`, `description` (from latest session or task), `date` (task createdAt), `timeWorked` (task totalTime in seconds).

2. **Update table headers** (lines 1033-1037): Add Description, Date, Time Worked columns between Vehicle and Client.

3. **Update table rows** (lines 1040-1049): Render description (from first session with a description, or "—"), formatted date, and formatted duration (HH:MM:SS) in the new columns.

4. **Update footer colspan** (line 1053): Change `colSpan` from 2 to 5 to span all columns before Cost.


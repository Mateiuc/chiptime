## Reorder Reports charts

In `src/components/DesktopReportsView.tsx`, change the chart grid order so "Revenue by Vehicle (Top 20)" and "Time worked per day" sit side-by-side (mirroring "Revenue Over Time" size), and move "Revenue by Client" beneath them.

### Changes

1. **Reorder cards** inside the `grid grid-cols-1 lg:grid-cols-2 gap-6` container:
   - Keep `Revenue Over Time` (full-width) first.
   - Move `Revenue by Vehicle (Top 20)` up — it becomes the left cell of the next row.
   - Keep `Time worked per day` right after it — right cell of that row.
   - Move `Revenue by Client` to come after that pair, full-width (`lg:col-span-2`).

2. **Match heights** so the Vehicle + Time row mirrors Revenue Over Time:
   - Replace `Revenue by Vehicle`'s dynamic height wrapper `<div style={{ height: vehicleChartHeight }}>` with `<div className="h-[380px]">`.
   - `Time worked per day` already uses `h-[380px]` — leave as is.
   - Both cards drop their `lg:col-span-2` (Vehicle never had it; just confirm both are single-column so they pair).

3. Leave `Revenue by Client`'s dynamic `clientChartHeight` as-is when moved (since it's full-width again).

### Out of scope

- No data/logic/color/tooltip changes.
- No changes to other charts (Tasks by Status, etc.).

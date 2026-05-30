## Unify Vehicle + Time charts; shrink Client chart

In `src/components/DesktopReportsView.tsx`:

### 1. Fix tooltip labels on "Time worked per day"
Currently bar `dataKey` is `v_<vehicleId>` or `p<n>`, so the tooltip shows raw keys. Extend `vehicleDaily` memo (line 328) to also return `labels: Record<string, string>`:
- All-vehicles mode (`v_<id>`): label = vehicle display string (`year make model` || VIN || "Unknown vehicle"), resolved from the `vehicles` prop. Add `vehicles` to memo deps.
- Drilled mode (`p<n>`): label = `Period N` (1-based).

Then pass `name={labels[key]}` on each `<Bar>` so Recharts tooltip shows the friendly name.

### 2. Unify color system between the two charts
Build a stable color map keyed by `vehicleId` derived from `revenueByVehicle` order (using the same `CHART_COLORS[(i + 3) % len]` formula). Use that map in the time chart's all-vehicles mode so each vehicle shares the exact same color in both charts. Drilled (per-period) mode keeps `PERIOD_COLORS`.

### 3. Shrink "Revenue by Client"
Replace the card's `lg:col-span-2` with single-column placement and swap the dynamic `clientChartHeight` wrapper for `h-[380px]`, matching Vehicle + Time per day. Keep all data/logic.

### Out of scope
- No changes to other charts, drill logic, or data computations.

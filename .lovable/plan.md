# Time worked per day — dual-stack bars

## Goal
On the "Time worked per day" chart (all-vehicles mode), each day currently shows ONE stacked bar colored only by vehicle. The user wants each day to also show period-level detail. Solution: render **two stacked bars per day, side by side** — left bar stacked by vehicle, right bar stacked by periods (when periods exist).

No size, layout, or other chart changes.

## Scope
File: `src/components/DesktopReportsView.tsx`, the `vehicleDaily` memo + the `Time worked per day` `<BarChart>` (~lines 338–622).

## Changes

### 1. `vehicleDaily` memo (all-vehicles branch, ~lines 379–393)
For each task's period, write **two** segments into the same day bucket:
- Vehicle segment: key `v_<vehicleId>`, stackId-group `veh`, label = vehicle display string (current behavior).
- Period segment: key `p_<globalPeriodIndex>`, stackId-group `per`, label = `Period N — <vehicle label>`.

Return shape becomes:
```
{ data, vehKeys: string[], perKeys: string[], labels: Record<string,string> }
```
(Drilled-vehicle branch keeps current behavior — only period segments, rendered as the single existing stack. `vehKeys = []`, `perKeys = segOrder`.)

### 2. Bar rendering (~lines 609–621)
Replace the single `.map(indices)` with two maps:
```tsx
{vehicleDaily.vehKeys.map((key, i) => (
  <Bar key={key} dataKey={key} name={labels[key]} stackId="veh"
       fill={vehicleColorMap[key.slice(2)] || CHART_COLORS[i % CHART_COLORS.length]} />
))}
{vehicleDaily.perKeys.map((key, i) => (
  <Bar key={key} dataKey={key} name={labels[key]} stackId="per"
       fill={PERIOD_COLORS[i % PERIOD_COLORS.length]} />
))}
```
Recharts automatically places bars with different `stackId` values side-by-side within the same x category, giving the half-and-half look the user described. When there are no periods (empty `perKeys`), only the vehicle bar renders — matching "when exist".

### 3. Tooltip
Existing `labelFormatter` sums all payload values. Update it to sum only one group (e.g. `veh`) to avoid double-counting the day's total — pick from `payload` entries whose `dataKey` starts with `v_`.

## Out of scope
- No changes to Revenue by Vehicle chart, Revenue Over Time, Revenue by Client, or any sizes/spans.
- No color palette changes.
- Drilled-vehicle view stays as-is (only periods).

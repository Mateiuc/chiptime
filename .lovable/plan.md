## Add per-day time chart (period segments) on vehicle drill in Reports

When the user clicks a bar in "Revenue by Vehicle", the existing `drillVehicle` table appears. Add a stacked bar chart above that table showing time worked per day for that vehicle, with each day's bar split into colored segments — one per period — exactly like the bill PDF chart.

## File

`src/components/DesktopReportsView.tsx`

## Reuse palette

Mirror the bill PDF palette so colors feel consistent. Add a local constant:

```ts
const PERIOD_COLORS = [
  '#800080', // purple
  '#2563eb', // blue
  '#16a34a', // green
  '#ea580c', // orange
  '#dc2626', // red
  '#ca8a04', // amber
  '#0d9488', // teal
  '#db2777', // pink
];
```

## Data shape

Build a memo `vehicleDailyData` derived from `drillVehicle` (only when set):

1. Collect `filteredTasks.filter(t => t.vehicleId === drillVehicle.vehicleId)`.
   - Store `vehicleId` on `DrillState` (extend interface) so we don't have to re-derive from label.
2. Walk those tasks → sessions → periods in chronological order, assigning each period a `globalIdx` (running counter) so it gets a stable color via `PERIOD_COLORS[globalIdx % 8]`.
3. Bucket periods by local calendar day (`YYYY-MM-DD`) using `period.startTime`. Skip periods with `duration <= 0`.
4. Sort days ascending. For each day, produce a row:
   ```ts
   { day: 'DD/MM', p0: secondsOrNullForGlobalIdx0, p1: ..., ... }
   ```
   Recharts needs one numeric key per stack segment. Use keys `p${globalIdx}` and only set the keys for periods that actually fall on that day.

## Render

Inside the Revenue-by-Vehicle card, right before `{drillVehicle && <DrillTable .../>}`, render when `drillVehicle && vehicleDailyData.length > 0`:

- Header: `Time worked per day — {drillVehicle.label}` with a small "Hide" button reusing the drill close pattern, or just rely on closing the drill itself.
- `ResponsiveContainer` height `Math.max(180, vehicleDailyData.length * 28 + 80)` (cap reasonable max ~360).
- `<BarChart data={vehicleDailyData}>` with `<XAxis dataKey="day">`, `<YAxis tickFormatter={s => formatHm(s)}>`, `<Tooltip formatter={(v) => formatHm(Number(v))}>`, `<CartesianGrid strokeDasharray="3 3">`.
- For each `globalIdx` present in the dataset, render one `<Bar dataKey={'p'+idx} stackId="day" fill={PERIOD_COLORS[idx % 8]} />`. Compute the list of present indices in a memo so we render the right number of `<Bar>`s.
- No `<Legend>` (matches PDF behavior).

## Helper

Add a small `formatHm(seconds)` local helper (`Xh Ym` / `Ym`) — or import existing one from `@/lib/formatTime` if present.

## Out of scope

- Other drills (client, status) keep existing behavior.
- No changes to PDF renderer.
- No new dependency (recharts already used).

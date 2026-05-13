# Phase 7 — Semantic correctness

Three changes to `src/components/DesktopReportsView.tsx`. No other files affected.

## 7.1 — Bucketing toggle (Work date vs Created date)

**State + helper** (top of component, near other `useState` calls):

```ts
const [bucketMode, setBucketMode] = useState<'work' | 'created'>('work');

const getTaskBucketDate = (task: Task): Date => {
  if (bucketMode === 'work') {
    let earliest: number | null = null;
    for (const s of task.sessions || []) {
      const t = new Date(s.startTime).getTime();
      if (!isFinite(t)) continue;
      if (earliest === null || t < earliest) earliest = t;
    }
    return new Date(earliest ?? task.createdAt);
  }
  return new Date(task.createdAt);
};

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
```

**Replace `new Date(t.createdAt)` bucketing in:**

- Date range filter inside `filteredTasks` (L180–186): use `getTaskBucketDate(t)` instead of `new Date(t.createdAt)`.
- `revenueOverTime` (L198–199), `hoursOverTime` (L248–249), `carsOverTime` (L260–261): use `getTaskBucketDate(t)` + `monthKey(d)`.
- `drillRowsForMonth` (L289–293): same — match by `monthKey(getTaskBucketDate(t))`.
- Add `bucketMode` to all relevant `useMemo` deps (`filteredTasks`, `revenueOverTime`, `hoursOverTime`, `carsOverTime`).

**UI control** in the filter bar between status toggles and the date pickers (around L376/377):

```tsx
<div className="flex items-center rounded-md border h-8 overflow-hidden">
  <button
    type="button"
    onClick={() => setBucketMode('work')}
    className={cn("px-2 text-xs h-full", bucketMode === 'work' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
  >Work date</button>
  <button
    type="button"
    onClick={() => setBucketMode('created')}
    className={cn("px-2 text-xs h-full border-l", bucketMode === 'created' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
  >Created date</button>
</div>
```

`resetFilters` (L137) resets `bucketMode` to `'work'`.

## 7.2 — Exclude imported tasks from hours

In `hoursOverTime` (L245) and `totalHours` (L286): filter out tasks where `t.importedSalary != null && t.importedSalary > 0` before summing seconds. Detail table, drill rows, and revenue charts are unchanged. The header summary chip "X hrs" reflects the filtered total.

## 7.3 — Top-20 vehicle chart with "Others" bar

Rewrite `revenueByVehicle` (L220–232):

```ts
const revenueByVehicle = useMemo(() => {
  const map: Record<string, { vehicleId: string; label: string; revenue: number }> = {};
  filteredTasks.forEach(t => {
    const v = vehicles.find(v => v.id === t.vehicleId);
    const label = v ? [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin : 'Unknown';
    if (!map[t.vehicleId]) map[t.vehicleId] = { vehicleId: t.vehicleId, label, revenue: 0 };
    map[t.vehicleId].revenue += getTaskCost(t);
  });
  const sorted = Object.values(map)
    .map(d => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);

  if (sorted.length <= 20) return sorted;

  const top = sorted.slice(0, 19);
  const rest = sorted.slice(19);
  const othersRevenue = Math.round(rest.reduce((s, r) => s + r.revenue, 0) * 100) / 100;
  return [
    ...top,
    { vehicleId: '__others__', label: `Others (${rest.length} vehicles)`, revenue: othersRevenue },
  ];
}, [filteredTasks, vehicles]);
```

Click handler (`handleVehicleClick`, L304): if `p.vehicleId === '__others__'`, set drill rows to all tasks whose `vehicleId` is in the `rest` set. Implement by capturing the "others" vehicle-ids inside the memo via a sibling `useMemo` (`othersVehicleIds`) returned alongside, or simpler: recompute the set inside the handler from `revenueByVehicle` length + a separate `useMemo`. Cleanest: also expose `othersVehicleIds` as a separate memo so the click handler has direct access.

For the bar color, pass a neutral gray (`#94a3b8`) only for the `__others__` row. Easiest way: in the chart's `<Bar>` use `<Cell>` per row (already common in this file's pattern) with `fill = entry.vehicleId === '__others__' ? '#94a3b8' : CHART_COLORS[i % CHART_COLORS.length]`.

`vehicleChartHeight` (L345) automatically grows to accommodate the extra bar.

## Verification

1. Toggle bucketing: a task created in March but with first session in April moves between months in Revenue Over Time, Hours Over Time, Cars Serviced.
2. Date range filter respects bucketing mode (a `from=Apr 1` filter excludes the same task when bucketing by Created if it was created in March, includes it when bucketing by Work).
3. Imported tasks contribute to revenue charts and detail table but not to Hours Over Time or the header "X hrs" chip.
4. With 25 vehicles in scope, vehicle chart shows 19 bars + 1 gray "Others (6 vehicles)" bar; clicking Others drills to those 6 vehicles' tasks.
5. Status filter toggles still affect chart contents; bucketing toggle is orthogonal.

## Out of scope (unchanged from spec)

CSV export, click-through to editor, URL persistence, Revenue Mix card — Phases 8–9.



# Fix Charts: One Entry Per Vehicle at Last Work Stop Date

## Problem
Currently the charts iterate over every session for every vehicle, which can count the same car in multiple months. You want each vehicle counted **once**, placed at the month when the **last work period of the last session ended** — the date the work was truly done on that car.

## Changes

### `src/components/ClientCostBreakdown.tsx` -- Update `monthlyData` logic (lines 98-118)

Replace the per-session loop with a per-vehicle approach:

1. For each vehicle in `filteredVehicles`, find the **last session** (by date)
2. From that last session, get the **last period's end time** (the final work stop)
3. Use that single date to place the vehicle on the chart
4. Sum **all** of that vehicle's costs (across all sessions) into that one month
5. Count the vehicle once in that month

```typescript
const monthlyData = useMemo(() => {
  if (filter !== 'paid') return [];
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthMap = new Map<string, { month: string; money: number; cars: Set<string> }>();

  filteredVehicles.forEach(v => {
    // Find the last session's last work stop date
    const allDates = v.sessions.map(s => new Date(s.date).getTime());
    if (allDates.length === 0) return;
    const lastStopDate = new Date(Math.max(...allDates));
    if (lastStopDate < cutoff) return;

    const key = `${lastStopDate.getFullYear()}-${String(lastStopDate.getMonth() + 1).padStart(2, '0')}`;
    const label = lastStopDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!monthMap.has(key)) monthMap.set(key, { month: label, money: 0, cars: new Set() });
    const entry = monthMap.get(key)!;
    // Sum ALL sessions' costs for this vehicle into that month
    entry.money += v.sessions.reduce((sum, s) => sum + s.laborCost + s.partsCost, 0);
    entry.cars.add(v.vehicle.vin);
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, v]) => ({ month: v.month, money: Math.round(v.money * 100) / 100, cars: v.cars.size }));
}, [filteredVehicles, filter]);
```

### Result
- Each vehicle appears **once** on the chart, at the month its work was last stopped
- The "Cars by Month" count will match reality (e.g., 12 cars total = 12 across all months combined)
- Revenue is grouped to the month of final work completion per vehicle
- Only the last 12 months are shown

### Files Changed
- `src/components/ClientCostBreakdown.tsx` -- rewrite monthlyData useMemo (lines 98-118)

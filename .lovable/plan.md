
# Fix Charts: Use Last Work Stop Date + Limit to 12 Months

## Problem
The charts use `session.createdAt` (when the session was first created) to place data on the monthly timeline. You want the date when work was **last stopped** instead. Also, charts should only show the most recent 12 months.

## Changes

### 1. `src/lib/clientPortalUtils.ts` -- Use last stopped date

Line 105: Change the `date` field from `session.createdAt` to the last work period's end time:

```typescript
// Change from:
date: session.createdAt,

// To:
date: session.completedAt
  || (session.periods.length > 0
      ? session.periods[session.periods.length - 1].endTime
      : session.createdAt),
```

This picks `completedAt` if available, otherwise the end time of the last work period, falling back to `createdAt`.

### 2. `src/components/ClientCostBreakdown.tsx` -- 12-month cutoff

In the `monthlyData` useMemo (line 98-115), add a cutoff so only the last 12 months are included:

```typescript
const monthlyData = useMemo(() => {
  if (filter !== 'paid') return [];

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const monthMap = new Map<string, { month: string; money: number; cars: Set<string> }>();
  filteredVehicles.forEach(v => {
    v.sessions.forEach(s => {
      const d = new Date(s.date);
      if (d < cutoff) return; // skip older than 12 months
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthMap.has(key)) monthMap.set(key, { month: label, money: 0, cars: new Set() });
      const entry = monthMap.get(key)!;
      entry.money += s.laborCost + s.partsCost;
      entry.cars.add(v.vehicle.vin);
    });
  });
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, v]) => ({ month: v.month, money: Math.round(v.money * 100) / 100, cars: v.cars.size }));
}, [filteredVehicles, filter]);
```

### Files Changed
- `src/lib/clientPortalUtils.ts` -- one line change (line 105) for date source
- `src/components/ClientCostBreakdown.tsx` -- add 12-month cutoff in useMemo (lines 98-115)

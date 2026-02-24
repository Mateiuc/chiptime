

# Client Portal: Tab Car Counts + Paid Tab Charts

## Overview
Add a footer section at the bottom of each tab showing the car count for that tab, and for the "Paid" tab specifically, add two bar charts: money per month and cars per month.

## Changes

### 1. `src/components/ClientCostBreakdown.tsx`

**Add car count footer for all tabs:**
- After the grand total card (or the empty message), add a small summary badge/text showing "X vehicles" for the current filtered view
- This uses `filteredVehicles.length` which is already computed

**Add charts for the "paid" tab only:**
- Import `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` from `recharts` (already installed)
- When `filter === 'paid'` and there are paid sessions, compute two datasets:
  1. **Money per month**: Group all paid sessions by month (from `session.date`), sum `laborCost + partsCost` per month
  2. **Cars per month**: Group paid sessions by month, count unique vehicles per month
- Render two `Card` components below the grand total, each containing a `ResponsiveContainer` with a `BarChart`
- Use the existing chart styling from the project (primary color for bars)
- Month labels formatted as "MMM YYYY" (e.g., "Jan 2025")

### 2. Technical Details

**Computing chart data (inside ClientCostBreakdown):**

```typescript
// Only when filter === 'paid'
const monthlyData = useMemo(() => {
  if (filter !== 'paid') return [];
  const monthMap = new Map<string, { month: string, money: number, cars: Set<string> }>();
  
  filteredVehicles.forEach(v => {
    v.sessions.forEach(s => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
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

**Chart rendering (after grand total, only when `filter === 'paid'` and `monthlyData.length > 0`):**

- Two side-by-side cards on desktop (`lg:grid-cols-2`), stacked on mobile
- Chart 1: "Revenue by Month" - Bar chart with money values, formatted as currency on Y-axis
- Chart 2: "Cars by Month" - Bar chart with car count on Y-axis
- Bar color: primary (`hsl(var(--primary))`)
- Height: 250px per chart

**Car count footer (all tabs):**

- A small centered text below everything: "Showing X vehicle(s)" using `filteredVehicles.length`
- Styled as `text-xs text-muted-foreground text-center py-4`

### 3. Files Changed

Only `src/components/ClientCostBreakdown.tsx` needs modification. No data pipeline changes needed since all the data (dates, costs, vehicle info) is already available in `filteredVehicles`.


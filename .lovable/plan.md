# Reports Overhaul — Phase 6: Math Consistency

Implement Phase 6 only. Pause for review before Phase 7.

## Changes

### 1. `src/lib/billing.ts` — add `computeTaskTotalAllocated`

New helper that allocates the vehicle-level discount proportionally across tasks (matching `computeVehicleTotal` math, just sliced per task):

```ts
export interface TaskTotalAllocated {
  labor: number; services: number; parts: number;
  discount: number; total: number;
}

export function computeTaskTotalAllocated(
  task: Task,
  vehicle: Vehicle | null | undefined,
  allVehicleTasks: Task[],
  client: Client | null | undefined,
  settings: Settings
): TaskTotalAllocated {
  const t = computeTaskTotal(task, client, settings);
  const taskPool = t.labor + t.services;
  const vehiclePool = allVehicleTasks.reduce((s, vt) => {
    const x = computeTaskTotal(vt, client, settings);
    return s + x.labor + x.services;
  }, 0);
  const vehicleDiscount = applyLaborDiscount(vehiclePool, vehicle).discount;
  const share = vehiclePool > 0 ? taskPool / vehiclePool : 0;
  const taskDiscount = vehicleDiscount * share;
  return {
    labor: t.labor, services: t.services, parts: t.parts,
    discount: taskDiscount,
    total: Math.max(0, taskPool - taskDiscount) + t.parts,
  };
}
```

Sum of `taskDiscount` across a vehicle's tasks equals the vehicle's discount within float rounding. Existing `computeVehicleTotal` is untouched.

### 2. `src/components/DesktopReportsView.tsx`

**6.5 — Remove dead import (L16):** drop `calcPeriodCost` from the `formatTime` import. Also drop `applyLaborDiscount` import (no longer used directly here) and add `computeTaskTotalAllocated`.

**6.1 + 6.2 — Rewrite `getTaskCost` (L143–149):**

```ts
const getTaskCost = (task: Task) => {
  const vehicle = vehicles.find(v => v.id === task.vehicleId);
  const client = clients.find(c => c.id === task.clientId) || null;
  const vehicleTasks = tasks.filter(t => t.vehicleId === task.vehicleId);
  return computeTaskTotalAllocated(task, vehicle, vehicleTasks, client, settings).total;
};
```

No more per-task full discount, no more `Math.ceil`. Display rounding is handled by `formatCurrency`.

**6.3 — Unpaid balance pill (search for the `'billed'`-only sum near L285):**

```ts
const unpaidBalance = filteredTasks
  .filter(t => t.status !== 'paid')
  .reduce((s, t) => s + getTaskCost(t), 0);
```

Now respects active filters and counts every non-paid status.

**6.4 — Imported badge in tables:**

- Import `ImportedBadge` from `@/components/ImportedBadge`.
- Extend `DrillRow` with `imported: boolean` (set in `toDrillRow` from `t.importedSalary != null && t.importedSalary > 0`).
- In `DrillTable` (L67) status cell: render `<ImportedBadge className="ml-1" />` next to the status pill when `r.imported`.
- In the detail table (L545) description/status cell: same badge inline.

## Verification (Phase 6)

1. Multi-task vehicle with a fixed-dollar discount → sum of per-task totals in Reports detail table now equals the `/desk` and `/client-view` vehicle total (was lower before).
2. Toggle status filters → unpaid pill value changes (was constant).
3. Imported task rows show the amber badge in both DrillTable and detail table.
4. `rg "calcPeriodCost" src/components/DesktopReportsView.tsx` returns zero matches.

## Out of scope for Phase 6

URL params, CSV export, click-through, bucketing toggle, Revenue Mix card, Top-20 Others bar, hours-chart imported filter — those land in Phases 7–9.

# Speed up the desktop Reports view

## What's slow

Opening Reports recomputes every task's money numbers many times over.

Confirmed in `src/components/DesktopReportsView.tsx`:

- `getTaskCost(task)` and `getTaskParts(task)` each scan the full task list (`tasks.filter(...)`) to find the task's sibling vehicle tasks, then call `computeTaskTotalAllocated`, which internally re-runs the full billing math for every one of those sibling tasks.
- They also do linear `clients.find` / `vehicles.find` lookups per call.
- These two helpers are called from ~10 separate memos (revenue over time, revenue mirror, by client, by vehicle, hours, cars, KPI totals, detail table, and every drill-down), so the same task is billed dozens of times per render.
- The itemized detail table renders every filtered row at once with no virtualization.

Net effect: cost grows roughly with (tasks x tasks per vehicle x consumers), which is why the view stalls before painting.

## The fix

1. Build lookup maps once per render: `clientsById`, `vehiclesById`, and `tasksByVehicleId`. Replaces every `.find`/`.filter` scan with a map hit.
2. Compute each task's numbers exactly once into a memoized `Map<taskId, { cost, parts, seconds, workerIds }>`, keyed on `tasks/clients/vehicles/settings`. All memos, KPI tiles, drill-downs, and the detail table read from that map instead of recomputing.
3. Memoize per-vehicle discount pools so a vehicle's pool is billed once rather than once per task on that vehicle.
4. Keep the numbers identical — same billing functions, same allocation rules, only fewer repeat calls.
5. Cap the itemized table to a windowed render (show first ~200 rows with a "show all" toggle) so a large filtered set doesn't block paint. Totals still cover the whole filtered set.

## Technical notes

- All changes stay inside `src/components/DesktopReportsView.tsx`; `src/lib/billing.ts` logic is untouched.
- The per-task cache is a `useMemo` returning a `Map`; the existing helpers become thin readers of that map so call sites don't change shape.
- Verification: compare KPI totals (revenue, unpaid balance, parts, hours) and a couple of drill-down tables before and after to confirm identical figures.

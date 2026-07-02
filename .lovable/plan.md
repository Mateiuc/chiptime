## Reports calculation fixes

### 1. Bug: deposits double-counted in "Received"

`src/components/DesktopReportsView.tsx` → `revenueMirror` memo has the deposit loop pasted twice (lines 271-280 and 281-290). Delete the duplicate copy. Each applied deposit will then be counted exactly once on its `depositApplied.at` month.

### 2. New Reports-only revenue formula

Parts become pass-through cost (not revenue). Cloning / programming / add-key / all-keys-lost stay IN (they're part of `services`). New per-task revenue used ONLY inside `DesktopReportsView`:

```
services    = cloning + programming + addKey + allKeysLost
taskRevenue = max(0, labor + services − vehicleDiscount) − parts
```

- `labor`, `services`, `parts` come from `computeTaskTotal(task, client, settings)`.
- `vehicleDiscount` = the task's allocated share (same allocation as `computeTaskTotalAllocated`, so vehicle rollups still reconcile).
- Not clamped to 0 — a parts-heavy task with no labor can show negative "revenue" (honest picture: shop lost margin on parts markup).
- Imported (XLS) tasks: `importedSalary` acts as labor, parts still subtracted.

Add `getTaskRevenue(task)` helper at the top of the component and replace every `getTaskCost(task)` call inside the file. Do NOT touch `src/lib/billing.ts`, invoices, bill PDFs, client portal, or the dashboard.

Affected memos/KPIs inside the file:
- `workerTotals.cost`
- `revenueOverTime.revenue`
- `revenueMirror.billed` and `.received` (received cash = `max(0, taskRevenue − depositAmt)` on `paidAt` month; deposits on `depositApplied.at` month, once)
- `revenueByClient.revenue`, `revenueByVehicle.revenue`
- `detailData` rows' `cost`
- `totalRevenue`, `unpaidBalance` KPIs

### 3. "Total Revenue" KPI = paid tasks only

Line 387: sum `taskRevenue` only for `t.status === 'paid'` within the filtered set. Also scope `unpaidBalance` (line 389) to `filteredTasks` with `status === 'billed'` so both KPIs respect the active filters.

### 4. Not changing

- "Billed" bars still bucket by `task.createdAt` (you didn't ask to change).
- Billing engine, invoices, bill PDFs, client portal totals — untouched.

### Verification after edit

1. Show the exact diff of `revenueMirror` (duplicate loop removed).
2. Walk through May 2026: list paid tasks with `paidAt` in May, compute `taskRevenue` per task, add deposits with `at` in May, report the total so you can eyeball vs the chart.

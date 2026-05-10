## Goal

Surface the per-vehicle labor discount on the desktop dashboard the same way deposits are surfaced today: as a chip on the vehicle row and the client header, with the math reading **Gross → Discount → Deposit → Balance Due**.

## Current behaviour (problem)

- Vehicle row shows: `$3,500  Deposit: $100  Balance Due: $3,400`
- Client header shows: `Total: $3,500  Due: $3,400  Car Deposits: $100`
- The `$3,500` is already **post-discount**; the $203 discount only appears as a tiny `-$203` badge on a single task. There is no Discount chip alongside Deposit, and you can't see what the gross was.

## Target behaviour

When the vehicle has a discount and there are un-billed tasks, the headers read:

- Vehicle row: `$3,703  Discount: -$203  Deposit: -$100  Balance Due: $3,400`
- Client header: `Total: $3,703  Discount: $203  Car Deposits: $100  Due: $3,400`

When no discount is set, layout is unchanged.

## Implementation

### 1. New helper next to `getTaskCost` (`src/pages/DesktopDashboard.tsx`)

Add `getTaskCostGross(task)` — same as `getTaskCost` but **does not** call `applyLaborDiscount`. Returns labor + parts before the per-vehicle discount. Billed/imported tasks return their locked amount unchanged (their discount is already baked in).

Also add a tiny `getVehicleDiscount(vehicle, vehicleTasks)` that:
- sums labor of un-billed tasks (not `billedAmount`, not `importedSalary`)
- returns `applyLaborDiscount(unbilledLabor, vehicle).discount` (one-time per vehicle, matching the fix already shipped to the portal)

### 2. Vehicle row header (around lines 1666–1701)

Replace the current `vehicleCost` / Deposit / Balance Due block with:

```text
vehicleGross   = sum(getTaskCostGross(t))
vehicleDiscount = getVehicleDiscount(vehicle, tasks)
deposit        = vehicle.prepaidAmount || 0
balanceDue     = max(0, vehicleGross - vehicleDiscount - deposit)   // for un-paid tasks only
```

Render in this order:
1. `formatCurrency(vehicleGross)` — main number (green/amber/blue per existing status logic)
2. `Discount: -$X` — emerald, only when `vehicleDiscount > 0`
3. `Deposit: $Y` — destructive red, only when `deposit > 0` (existing styling)
4. `Balance Due: $Z` or `Paid` — orange/emerald (existing logic, recomputed)

### 3. Client header summary (around lines 1619–1638 and the parallel block ~1288)

```text
clientGross    = sum over vehicles of vehicleGross
clientDiscount = sum over vehicles of vehicleDiscount
vehicleDeps    = sum of vehicle.prepaidAmount
clientDep      = client.prepaidAmount
unpaidGross    = sum(getTaskCostGross) for tasks where status !== 'paid'
balanceDue     = max(0, unpaidGross - clientDiscount(unpaid only) - vehicleDeps - clientDep)
```

Render: `Total: $gross` → `Discount: $X` (emerald, when > 0) → `Due: $balance` → `Car Deposits` → `Client Deposit`.

### 4. Per-task badge (line 1804)

Keep the small `🏷 -10%` / `🏷 -$203` badge on un-billed tasks for at-a-glance scanning. The chip is informational; the actual amount is now reflected in the vehicle/client totals above.

### 5. Anywhere `getTaskCost` is summed for a "revenue" header

Audit the other call sites that feed the same headers (lines 1288, 1339, 1619, 1666, 1937 — chart + Expected Gain). Update only the ones that drive the **vehicle/client revenue chips** to use `getTaskCostGross` so the headline matches the new "gross" presentation. Leave analytics/chart series (`monthlyRevenueData`, Expected Gain) on `getTaskCost` (post-discount) so reports keep showing actual money earned — discounts shouldn't inflate revenue charts.

### Out of scope

- Mobile UI, bill PDF, client portal — already updated in the previous turn.
- `applyLaborDiscount` math and per-task `billedAmount` locking behaviour — unchanged.

## Problem

My previous fix only checked `filter === 'paid'`. But the user is on the **All** tab (see screenshots) where the task IS paid — so deposit-as-history styling never kicked in. We need to drive the styling off **task payment status**, not the tab filter.

## Rule (applies app-wide)

For any scope (single task, vehicle, or client), compute:
- `unpaidRevenue` = sum of `getTaskCost(t)` for tasks where `t.status !== 'paid'`
- `effectiveDeposits` = vehicle.prepaidAmount (+ client.prepaidAmount where shown)
- `balanceDue` = `max(0, unpaidRevenue - effectiveDeposits)`
- `isFullyPaid` = `unpaidRevenue === 0` (every task in scope is paid)

Then:
- **isFullyPaid = true** → total in green, deposit shown in muted (`text-muted-foreground`) as historical, **no** "Due" / "Balance Due" line. If filter happens to be `paid`, also show "PAID" / "PAID IN FULL" badge.
- **isFullyPaid = false** → existing behavior (red deposit, orange Due/Balance Due).

This naturally fixes all tabs (All, Active, Billed, Paid) for any client/vehicle whose tasks are all paid.

## Files to change

### 1. `src/components/TaskCard.tsx` (lines ~1604‑1609)
Single‑task scope. `isFullyPaid = task.status === 'paid'`.
- Paid → muted "Deposit: -$X" + green "Paid: $Y" (where Y = totalCost shown as green positive). No "Balance Due" row.
- Otherwise → unchanged (red Deposit, orange Balance Due).

### 2. `src/pages/DesktopDashboard.tsx`

**a) Sidebar client list (~lines 1234‑1246):**
Compute `unpaidRevenue` over `clientVehicles.flatMap(v=>v.tasks)`. If unpaidRevenue === 0 → green `clientRevenue`, no "Due:". Else if deposits>0 → orange "Due: …". Else green/blue per filter.

**b) Overview client cards (~lines 1278‑1301):**
Same `unpaidRevenue` calc. If 0 → green big total, muted "Deposit: -$X" history line, NO "Due:" row. Else current red+orange behavior.

**c) Expanded client header totals (~lines 1541‑1560):**
Same calc. If `unpaidRevenue === 0` → Total green, hide "Due:", show "Car Deposits"/"Client Deposit" in muted. Else current behavior.

**d) Vehicle header (~lines 1602‑1619):**
Compute `vehicleUnpaid` = sum over vehicleTasks where status!=='paid'. If 0 → green vehicleCost, muted "Deposit: $X", green "Paid" (no "Balance Due"). Else if deposit covers cost → green "Paid". Else orange "Balance Due: …".

### 3. `src/components/ClientCostBreakdown.tsx` (mobile/portal — lines ~258‑271, 385‑395, 418‑432)

The portal uses `filter` prop to scope which sessions are shown, so a vehicle on the Paid tab is by definition fully paid — current `filter === 'paid'` check there is correct. **No changes needed** unless we want to also fix the All-equivalent (none in portal). Leave as-is.

## Verification

1. Mobile **Paid Tasks** dialog (Settings → View Paid Tasks) on a paid task with deposit: shows muted "Deposit: -$800", green "Paid: $5,191". No red/orange.
2. Desktop **All** tab — Valy Ilasca card: green "$5,186", muted "Deposit: -$800", **no** "Due:" line.
3. Desktop **All** tab — expanded Valy Ilasca: green Total $5,186, **no** "Due:" badge, muted "Car Deposits: $800". Vehicle row: green "$5,186", muted "Deposit: $800", green "Paid" (no Balance Due).
4. Desktop **Active/Billed** tabs on a client with mixed paid+unpaid tasks: still shows orange "Due:" computed against the unpaid portion only. Red deposit color preserved when there is a real outstanding balance.
5. A client with active tasks AND paid tasks: deposit displayed in red, "Due" reflects only unpaid revenue minus deposits.

## Goal
When a billed task is marked **Paid**, automatically debit its total from the deposit pool (vehicle deposit first, then client deposit). Use a **ledger** so the original deposit is preserved and the operation is reversible.

## Data model (additive, no migrations to existing fields)

Add one new field per task in `src/types/index.ts`:

```ts
// Task
depositApplied?: {
  vehicle: number; // dollars drawn from vehicle.prepaidAmount
  client: number;  // dollars drawn from client.prepaidAmount
  at: Date;        // when the debit was recorded (= paidAt)
};
```

The original `vehicle.prepaidAmount` and `client.prepaidAmount` are **never mutated**. The remaining deposit is always derived:

```
remainingVehicleDeposit(vehicle) =
    (vehicle.prepaidAmount || 0)
  − Σ task.depositApplied.vehicle  for tasks on this vehicle

remainingClientDeposit(client) =
    (client.prepaidAmount || 0)
  − Σ task.depositApplied.client   for all tasks belonging to this client
```

## Algorithm — on "Mark as Paid"

Centralized in a new helper `src/lib/deposit.ts`:

```ts
applyDepositOnPaid(task, vehicle, client, allTasksForClient) →
  { vehicle: number, client: number, at: Date }
```

Steps:
1. Compute `taskTotal = computeTaskCost(task, ...)` (single source of truth already exists).
2. Compute remaining pools using the formulas above (excluding the current task).
3. Draw `vehicleDraw = min(taskTotal, remainingVehicleDeposit)`.
4. Draw `clientDraw  = min(taskTotal − vehicleDraw, remainingClientDeposit)`.
5. Return `{ vehicle: vehicleDraw, client: clientDraw, at: new Date() }`.
   Sum may be `< taskTotal` (deposit exhausted → balance still owed but recorded as paid, same as today).

## Algorithm — on "Un-mark Paid" / status change away from paid
Clear `task.depositApplied`. Because the ledger is derived from tasks, removing the entry restores the deposit automatically.

## Wire-up points (only places that flip a task to/from `paid`)
- `src/pages/Index.tsx:500` — mobile flow
- `src/pages/DesktopDashboard.tsx:577` and the bulk path near line 582
- `src/pages/ClientPortal.tsx` — if it can mark paid
- `src/components/EditTaskDialog.tsx` — status change branch

Each call site replaces its current `updateTask(id, { status: 'paid', paidAt })` with:
```ts
const applied = applyDepositOnPaid(task, vehicle, client, clientTasks);
updateTask(id, { status: 'paid', paidAt: applied.at, depositApplied: applied });
```
And when status leaves `paid`, also pass `depositApplied: undefined`.

## Display updates (read-only — use derived helpers)
Replace inline `vehicle.prepaidAmount || 0` / `client.prepaidAmount || 0` with `remainingVehicleDeposit(...)` / `remainingClientDeposit(...)` in:
- `src/pages/DesktopDashboard.tsx` (lines ~763, 805, 1062, 1124, 1399, 1454)
- `src/components/ClientCostBreakdown.tsx` (lines ~262, 468–476)
- `src/lib/billPdfRenderer.ts` and `src/lib/clientPortalUtils.ts` deposit rows
- `src/components/TaskCard.tsx` deposit display

The "Paid" filter view (already shows historical totals) shows the original deposit as consumed, matching today's UX.

## Tests
Add `src/lib/__tests__/deposit.test.ts`:
- Single paid task < vehicle deposit → draws from vehicle only.
- Single paid task > vehicle deposit → spills into client deposit.
- Single paid task > vehicle + client deposit → both drained, remainder unbilled.
- Two paid tasks consume sequentially without double-counting.
- Un-marking paid restores remaining deposits exactly.
- Editing a paid task's amount does **not** retroactively change `depositApplied` (locked at paid time — by design for audit).

## Out of scope
- No changes to `billing.ts` math.
- No UI redesign — only swap deposit reads for the derived helpers.
- No retro-migration: existing paid tasks have no `depositApplied`, so they consume `0` from the ledger (today's behavior). A one-time backfill can be added later if requested.
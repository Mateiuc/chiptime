# Deposits applied at "Billed"

Today a deposit is only drawn when a task is marked **Paid**. Billed tasks still show the full amount even when the customer already left money up front. This changes that.

## Behaviour

1. When a task is marked **Billed**, the deposit is drawn immediately — vehicle deposit first, then client deposit — and recorded on the task (same ledger already used for Paid, so nothing is double-counted).
2. The billed task shows **Amount due = bill − deposit applied**, with a line showing how much deposit was used.
3. If the deposit covers the whole bill (nothing left owed), the task is settled automatically and moves to **Paid** — that is the app's "fully settled, nothing owed" state; leaving it in Completed would put it back into the un-billed work list.
4. Leftover deposit stays as credit and is available for the next task on that vehicle/client.
5. Reverting a billed task back to Completed/Pending clears the recorded deposit, restoring the credit pool.

## Client header line (the highlighted row)

The client row in the desktop dashboard currently reads `Total: $2,008   Client Deposit: $4,700`. It becomes three figures:

```text
Total: $2,008    Deposit Left: $2,692    Full Deposit: $4,700
```

- **Total** — unchanged, the client's billed/work total.
- **Deposit Left** — full deposit minus what billed work has consumed. Shown green while positive, red/zero when exhausted.
- **Full Deposit** — the original deposit amount, muted, so the starting figure is still visible.

Car deposits keep their own entry with the same left/full treatment.

## Where else it shows up

- Mobile task cards and desktop dashboard task rows: billed amount due is net of the deposit.
- Client cost breakdown / "TOTAL DUE": net of deposits, with a deposit line.
- Client portal: same net figure so the customer sees the real balance.
- Reports: unpaid balance uses the net amount due.

## Technical notes

- Rename/generalise `applyDepositOnPaid` in `src/lib/deposit.ts` to a status-agnostic `applyDeposit(task, ...)`; keep allocation order (vehicle then client) and the idempotent "exclude self" logic.
- `handleMarkBilled` in `src/pages/Index.tsx` and `src/pages/DesktopDashboard.tsx`: compute `depositApplied`, write it with the status flip, and if `computeTaskCost - (vehicle + client) <= 0` set `status: 'paid'` + `paidAt` instead of `'billed'`.
- `handleMarkPaid` stays as-is but reuses an already-recorded `depositApplied` when present rather than re-drawing.
- Status changes that leave `billed`/`paid` (edit dialogs, revert actions) must set `depositApplied: undefined`.
- Add a shared `amountDueForTask(task, ...)` helper = `computeTaskCost − depositApplied` and use it in `TaskCard.tsx`, `ClientCostBreakdown.tsx`, `DesktopReportsView.tsx` (`unpaidBalance`) and `clientPortalUtils.ts`, replacing the ad-hoc `totalCost - remainingVehicleDeposit(...)` display math in `TaskCard.tsx`.
- Client header line: `src/pages/DesktopDashboard.tsx` around lines 1559-1584 — keep `remainingClientDeposit` / `remainingVehicleDeposit` for "left" and add the raw `client.prepaidAmount` / summed `vehicle.prepaidAmount` for "full".
- Extend `src/lib/__tests__/deposit.test.ts` with cases for draw-at-billed, full coverage auto-paid, and revert clearing the ledger.

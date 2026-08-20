# Deposit vs. worked — info line on the client row

Display-only change. No task status changes, no automatic "paid", no change to the deposit ledger or to how bills are calculated.

## What changes

The client header row in the desktop dashboard currently reads:

```text
Total: $2,008    Client Deposit: $4,700
```

It becomes three figures:

```text
Total: $2,008    Deposit Left: $2,692    Full Deposit: $4,700
```

- **Total** — unchanged.
- **Deposit Left** — full deposit minus the billed amount for that client. Green while positive; red when the billed work exceeds the deposit (shown as the over-amount so it's obvious the client owes more than they put down).
- **Full Deposit** — the original deposit amount, muted, so the starting number stays visible.

Car deposits get the same left / full treatment on their own entry.

This is purely a reminder of where the client stands against their deposit — nothing is marked paid and no deposit is consumed by it.

## Technical notes

- Edit the totals block in `src/pages/DesktopDashboard.tsx` (around lines 1559-1584).
- "Worked" = sum of task cost for the client's tasks with status `billed` or `completed`, using the existing `getTaskCost` helper already in scope.
- Deposit Left = `client.prepaidAmount − worked` (clamped display, negative shown as over-deposit). Full Deposit = raw `client.prepaidAmount`; vehicle equivalent sums `vehicle.prepaidAmount`.
- `remainingClientDeposit` / `remainingVehicleDeposit` and `applyDepositOnPaid` are untouched — the existing paid-time ledger keeps working exactly as it does today.

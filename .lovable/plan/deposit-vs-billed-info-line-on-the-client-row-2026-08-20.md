# Deposit vs. billed — info line on the client row

Display-only change. No task status changes, no automatic "paid", no change to the deposit ledger or to how bills are calculated.

## What changes

The client header row in the desktop dashboard currently reads:

```text
Total: $2,008    Client Deposit: $4,700
```

That `$2,008` is the Completed total (the Completed filter is active in the screenshot), not the billed total — the new deposit figure is not derived from it.

It becomes three figures:

```text
Total: <unchanged>    Deposit Left: <full deposit − billed>    Full Deposit: <original deposit>
```

- **Total** — unchanged, whatever the current filter shows.
- **Deposit Left** — full deposit minus the client's **billed** amount (tasks in Billed status only, regardless of which filter is on screen). Green while positive; red when billed work exceeds the deposit, showing the over-amount.
- **Full Deposit** — the original deposit amount, muted, so the starting number stays visible.

Car deposits get the same left / full treatment on their own entry.

This is purely a reminder of where the client stands against their deposit — nothing is marked paid and no deposit is consumed by it.

## Technical notes

- Edit the totals block in `src/pages/DesktopDashboard.tsx` (around lines 1559-1584).
- "Billed amount" = sum of task cost across the client's tasks with status `billed`, computed from the full task list (not the filtered view), using the existing `getTaskCost` helper.
- Deposit Left = `client.prepaidAmount − billed` (negative shown as over-deposit). Full Deposit = raw `client.prepaidAmount`; vehicle equivalent sums `vehicle.prepaidAmount`.
- `remainingClientDeposit` / `remainingVehicleDeposit` and `applyDepositOnPaid` are untouched — the existing paid-time ledger keeps working exactly as it does today.

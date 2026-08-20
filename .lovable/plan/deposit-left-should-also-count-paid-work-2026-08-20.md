# Deposit Left should also count paid work

## What's happening

Marking a car Paid does draw from the deposit ledger — `applyDepositOnPaid` records the amount into the task and `remainingVehicleDeposit` / `remainingClientDeposit` shrink accordingly (`src/lib/deposit.ts`, used from `src/pages/DesktopDashboard.tsx:699-707` and `src/pages/Index.tsx:469-472`).

The problem is the new info line on the client row. It computes:

```text
Deposit Left = Full Deposit − (tasks with status 'billed')
```

Paid tasks are not counted. So the moment a billed task flips to Paid, it leaves the "billed" bucket and Deposit Left jumps back up — it looks like the deposit was never touched.

## The fix

Change the info line so Deposit Left counts both:

```text
Deposit Left = Full Deposit − (still-billed work + deposit already consumed by paid tasks)
```

- Deposit already consumed by paid tasks = the ledger amounts stored on those tasks (`depositApplied`), which is exactly what the app debited when each was marked Paid.
- Still-billed work stays as it is today.
- Negative result keeps showing as "Deposit Over" in red.

Same treatment for the car deposit line. Display only — no status changes, no change to how deposits are debited.

## Technical notes

- Edit `src/pages/DesktopDashboard.tsx` lines 1566-1571.
- Client: `clientDepositLeft = clientFullDeposit − clientBilled − sumDepositAppliedToClient(client.id, tasks)`.
- Vehicle: `vehicleDepositLeft = vehicleFullDeposit − vehicleBilled − Σ sumDepositAppliedToVehicle(vehicle.id, tasks)`.
- Both helpers already exist and are exported from `src/lib/deposit.ts`; add them to the existing import.
- `remainingClientDeposit` / `remainingVehicleDeposit` and the `Due:` figure stay untouched.

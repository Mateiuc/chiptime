

# Fix: Client Summary Cards Not Showing Deposit/Balance Due

## Problem
The client summary cards (overview grid and sidebar list) in DesktopDashboard show the raw total cost without accounting for deposits. The user sees "$3,713.53" but if a deposit exists, they expect to see the balance due or at least see the deposit mentioned.

## Changes

### `src/pages/DesktopDashboard.tsx`

**1. Sidebar client list (lines 1135-1158)**
After the `clientRevenue` line, calculate `clientDeposits` from the client's vehicles. If deposits exist, show the balance due amount instead of (or alongside) the raw total.

```
const clientDeposits = clientVehicles.flatMap(v => v.vehicles || [v]).reduce(...)
```

Wait — `clientVehicles` here is already the vehicle array from `filteredTree`. Need to sum `prepaidAmount` from the actual vehicle objects. The `filteredTree` structure is `{ client, vehicles: { vehicle, tasks }[] }`. So:

```typescript
const clientDeposits = clientVehicles.reduce((sum, v) => sum + (v.vehicle?.prepaidAmount || 0), 0);
```

Actually let me check the tree structure.

Looking at lines 1135-1136: `filteredTree.map(({ client, vehicles: clientVehicles })` — and line 1446 shows `clientVehicles.map(({ vehicle, tasks: vehicleTasks })`. So `clientVehicles` is `Array<{ vehicle: Vehicle, tasks: Task[] }>`.

**Sidebar (lines 1151-1156)**: After `clientRevenue`, calculate deposits and show balance due if deposits exist:
```typescript
const clientDeposits = clientVehicles.reduce((sum, cv) => sum + (cv.vehicle?.prepaidAmount || 0), 0);
```
- If `clientDeposits > 0`: show balance due amount in orange instead of raw total in green
- If no deposits: show raw total in green (current behavior)

**2. Overview cards (lines 1171-1193)**
Same logic — calculate deposits and show deposit + balance due below the total if deposits exist.

**3. Vehicle header (lines 1450, 1465-1467)**
Already shows deposit and balance due — no change needed.

### Summary of UI changes

| Location | Current | After Fix |
|----------|---------|-----------|
| Sidebar client row | Green "$3,713.53" | Green "$3,713.53" + orange "Due: $X" if deposit |
| Overview client card | Green "$3,713.53" | Green "$3,713.53" + red "Deposit" + orange "Due: $X" if deposit |
| Vehicle header | Already shows deposit/balance | No change |

Only 2 spots to update, both in `DesktopDashboard.tsx`.


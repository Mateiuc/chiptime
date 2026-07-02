## Fix double-counting in Reports "Received"

My previous change added `depositApplied` amounts on top of the task total — but `getTaskCost(task)` already includes everything the client owed, deposit portion included. Result: May shows ~2× the real received amount.

### Correct math

For each paid task:
- **Cash received on `paidAt`** = `taskTotal − (depositApplied.vehicle + depositApplied.client)`
- **Deposit received on `depositApplied.at`** = `depositApplied.vehicle + depositApplied.client`

Sum of both = `taskTotal`. No double counting. If a task has no `depositApplied`, all of `taskTotal` lands on `paidAt` as before.

### Files touched

- `src/components/DesktopReportsView.tsx` — `revenueMirror` memo: subtract deposit portion from the `paidAt` bucket, keep the separate deposit bucket on `depositApplied.at`.

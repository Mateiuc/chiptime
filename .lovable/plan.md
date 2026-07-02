## Add deposits to Reports "Received"

Currently the "Received" chart in Desktop Reports only counts task totals on `paidAt` (with the recent fallback). Deposits that were used to pay tasks aren't visible as their own line item.

### Change

In `src/components/DesktopReportsView.tsx`, extend the `revenueMirror` memo so each task contributes two things to the monthly buckets:

1. **Task received** — already there. Uses `paidAt ?? lastSessionEnd ?? createdAt`, value = task total.
2. **Deposit received (new)** — when `task.depositApplied` exists, add a bar entry:
   - date = `task.depositApplied.at`
   - value = `depositApplied.vehicle + depositApplied.client`
   - month bucket = same YYYY-MM key

Both accumulate into the same monthly "Received" bar so the user sees the true cash flow that month (task cash + deposit draw).

### No schema / no writes

- `depositApplied.at` already exists on paid tasks (set in `src/lib/deposit.ts`).
- No migration, no data backfill, no business-logic change.
- Presentation-only edit in one file.

### Files touched

- `src/components/DesktopReportsView.tsx` — `revenueMirror` memo only.

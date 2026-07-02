## Revert paidAt fallback, keep deposit-only change

Per your direction: don't touch anything related to `paidAt`. Only the deposit contribution should be added.

### Change in `src/components/DesktopReportsView.tsx` — `revenueMirror` memo

Restore the original strict `paidAt` filter, but keep the deposit bucketing:

1. **Cash on `paidAt`** — only tasks with a real `paidAt`. Amount = `taskTotal − depositApplied`. Tasks without `paidAt` contribute nothing (original behavior).
2. **Deposit on `depositApplied.at`** — unchanged from last turn. Uses real timestamp only.

This removes the "last-session-end" fallback that was inflating May from the Valy Ilscu 61-hour task.

### Files touched

- `src/components/DesktopReportsView.tsx` — drop the fallback date resolver, keep deposit block.

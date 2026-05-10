## Problem

In the client portal, billed/paid tasks show the full task labor on **session 1** and **$0** on every following session of the same task. Example from your screenshot: a Mercedes task with 3 sessions shows `$5,191` on Jan 9 and `$0` on Jan 12 / Jan 13.

## Cause

`task.billedAmount` (and `task.importedSalary`) are stored **per task**, not per session. In `src/lib/clientPortalUtils.ts` (`calculateClientCosts`), the code dumps the whole amount on the first session it processes and assigns `0` to every other session of the same task:

```ts
if (task.billedAmount != null) {
  laborCost = importedSalaryApplied ? 0 : task.billedAmount;
  importedSalaryApplied = true;
}
```

Vehicle/total math is correct (the amount is counted once), but the **per-session display** is wrong: clients see $0 lines that look like errors.

## Fix

Distribute the task's billed/imported labor across that task's sessions, **proportional to each session's duration**. Totals stay identical; only the per-session breakdown changes.

### Change in `src/lib/clientPortalUtils.ts` (`calculateClientCosts`)

1. Before iterating `task.sessions.forEach(...)`, compute `taskTotalDuration` for the task.
2. For each session, compute `sessionShare = taskTotalDuration > 0 ? duration / taskTotalDuration : 1 / task.sessions.length`.
3. Replace the `importedSalaryApplied` short-circuit with proportional allocation:
   - `if (task.billedAmount != null)` → `laborCost = round(task.billedAmount * sessionShare)`
   - `else if (task.importedSalary != null)` → `laborCost = round(task.importedSalary * sessionShare)`
4. To avoid rounding drift, give the **last session** the remainder (`taskTotal - sum of previous sessions`) so the per-session pieces always sum back to the locked task total.
5. Remove the `importedSalaryApplied` flag — no longer needed.

### Out of scope

- No changes to vehicle/client totals, discount math, bill PDF, or desktop dashboard — they already use the per-task locked amount and remain correct.
- No schema changes. No portal sync changes (the slim payload already carries `lc` per session).

## Verification

- Open the same client portal: each session under a billed/paid task now shows a sensible dollar amount, and the sum across sessions equals the locked task total shown on the vehicle header.
- Pending tasks unchanged.
- `Hours × rate` still matches roughly because allocation is duration-weighted.

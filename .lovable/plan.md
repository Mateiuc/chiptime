

# Add "Minimum 1-Hour Charge" Option to Complete Work Dialog

## Summary
Add a checkbox/switch to the Complete Work dialog that, when a session's total time is less than 1 hour, bills the client for a full hour. The actual work periods (start/end times) remain unchanged — only the billing calculation uses the padded time.

## Approach

### 1. Add `chargeMinimumHour` field to `Task` type (`src/types/index.ts`)
- Add `chargeMinimumHour?: boolean` to the `Task` interface
- This flag is stored per-task so billing calculations can reference it later

### 2. Add checkbox to `CompleteWorkDialog` (`src/components/CompleteWorkDialog.tsx`)
- Add a `chargeMinimumHour` state (default false)
- Show a new card/switch row (similar to "More work needed") labeled "Charge minimum 1 hour" with description "If total work is less than 1 hour, bill for a full hour"
- Only show this option when relevant (could always show it for simplicity)
- Pass `chargeMinimumHour` through the `onComplete` callback — update signature to include 4th parameter

### 3. Update `handleCompleteWork` in `Index.tsx`
- Accept 4th param `chargeMinimumHour: boolean`
- Store `chargeMinimumHour` on the task via `updateTask`

### 4. Update billing calculations everywhere labor cost is computed
- In `TaskCard.tsx`, `DesktopDashboard.tsx`, `DesktopClientsView.tsx`, and anywhere `totalTime / 3600 * hourlyRate` is used:
  - If `task.chargeMinimumHour && task.totalTime < 3600`, use `3600` instead of `task.totalTime` for billing
- The actual `totalTime` and period start/end times stay untouched

### Files changed
- `src/types/index.ts` — add `chargeMinimumHour?: boolean`
- `src/components/CompleteWorkDialog.tsx` — add switch + pass value
- `src/pages/Index.tsx` — accept and store the flag
- `src/components/TaskCard.tsx` — use flag in cost calculation
- `src/pages/DesktopDashboard.tsx` — use flag in cost calculation
- `src/components/DesktopClientsView.tsx` — use flag in cost calculation


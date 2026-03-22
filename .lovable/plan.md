

# Fix: Mobile Task Completion Race Condition

## Problem
When you stop and complete a task on mobile, TWO competing `updateTask` calls fire nearly simultaneously:
1. `handleStopTimer` writes `status: 'paused'` (with final work period)
2. `handleCompleteWork` writes `status: 'completed'` (with session description/parts)

Both are async and neither is awaited. They both read current tasks from storage independently, so whoever writes LAST wins. If the `paused` write finishes after the `completed` write, the cloud gets `paused` — which is exactly what happened to task `96577188`.

## Fix (single file: `src/pages/Index.tsx`)

### 1. Make `handleStopTimer` NOT write to storage when completing
- When the user stops a timer to complete work, don't call `updateTask` with `paused` status
- Instead, compute the final period and updated sessions, store them in a ref/state variable
- Only open the `CompleteWorkDialog` with this pre-computed data
- This eliminates the first write entirely — no race possible

### 2. Make `handleCompleteWork` do the single authoritative write
- Use the pre-computed sessions (with final period included) from step 1
- Write `status: 'completed'` with the complete session data in ONE `updateTask` call
- This single write gets pushed to cloud with the correct final state

### 3. Handle "Cancel" in CompleteWorkDialog
- If user cancels (closes dialog without completing), THEN write the `paused` state with the computed sessions
- This ensures no data loss if user decides not to complete

### What stays the same
- `useStorage.ts` — no changes
- `appSyncService.ts` — no changes
- `sync-data` edge function — no changes
- All other handlers (pause, restart, etc.) — no changes
- The debounced cloud push mechanism — no changes

### Result
After this fix, completing a task on mobile will write `completed` to storage exactly once, and the 3-second debounced push will send the correct status to cloud. Browser refresh will then load `completed`.


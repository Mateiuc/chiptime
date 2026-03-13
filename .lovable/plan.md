

# Fix: Cancel in CompleteWorkDialog Leaves Task in Broken State

## Root Cause

In `handleStopTimer`, the task's `startTime` is cleared and the final period is saved, but the **status remains `'in-progress'`**. When the user cancels the dialog:

- The task is `'in-progress'` with no `startTime` — a broken state
- The UI shows it as "running" even though the timer isn't actually ticking
- This means multiple tasks can appear as `'in-progress'` simultaneously

## Fix — `src/pages/Index.tsx`

### 1. Set status to `'paused'` in `handleStopTimer`

When the timer is stopped (line ~271), also set `status: 'paused'` in the `updateTask` call. This way:
- If the user **completes** → `handleCompleteWork` changes status to `'completed'` (already works)
- If the user **cancels** → task stays `'paused'`, which is correct since the timer was stopped

### 2. Handle cancel explicitly

In the `onOpenChange` callback (line ~776), when the dialog closes without completing, no extra work needed since the task is already `'paused'`.

### Single change

In `handleStopTimer`, add `status: 'paused'` to the `updateTask` call at line 271:

```typescript
updateTask(activeTask.id, {
  status: 'paused',        // ← ADD THIS
  sessions: updatedSessions,
  totalTime: activeTask.totalTime + elapsed,
  startTime: undefined,
  activeSessionId,
});
```

Also handle the case where the task was already `'paused'` (no running timer) — it should remain `'paused'`, which it already does since `updateTask` isn't called in that branch.

## Files Changed
- `src/pages/Index.tsx` — 1-line addition in `handleStopTimer`


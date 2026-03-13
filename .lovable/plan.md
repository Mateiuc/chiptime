

# Fix: Wrong Task Completed When Stopping Bottom Car

## Root Cause

Both `handleStopTimer()` and `handleCompleteWork()` use `tasks.find(t => t.status === 'in-progress' || t.status === 'paused')` to locate the task. This always returns the **first** matching task in the array — not the one the user actually clicked "Stop" on. When multiple tasks are active/paused, the wrong task gets completed.

## Fix

### 1. Track which task is being stopped (`src/pages/Index.tsx`)

- Add state: `const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null)`
- Change `onStopTimer` prop from `() => void` to `(taskId: string) => void`
- In `handleStopTimer(taskId)`: find the task by ID instead of scanning for first active
- In `handleCompleteWork()`: use `stoppingTaskId` to find the correct task instead of scanning
- Clear `stoppingTaskId` after completing

### 2. Pass task ID from TaskCard (`src/components/TaskCard.tsx`)

- Where the Stop button calls `onStopTimer?.()`, change to `onStopTimer?.(task.id)`

### 3. Show vehicle name in CompleteWorkDialog (`src/components/CompleteWorkDialog.tsx`)

- Add optional `vehicleLabel` prop (string like "2020 Toyota Camry - ABC123")
- Display it at the top of the dialog content, above "Work Description", as a visual safety check
- In `Index.tsx`, compute and pass the label from the vehicle/task being stopped

## Files Changed
- `src/pages/Index.tsx` — add `stoppingTaskId` state, fix both handlers to use explicit ID, pass vehicle label
- `src/components/TaskCard.tsx` — pass `task.id` to `onStopTimer`
- `src/components/CompleteWorkDialog.tsx` — add `vehicleLabel` prop, display above description


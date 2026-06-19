Add a **Stop** button on the desktop task header (the area circled in red on `Task 1`) that mirrors the mobile Stop flow exactly.

## Where
`src/pages/DesktopDashboard.tsx`, inside the task header row (~lines 1528–1568, the right-side action button group, before the Pencil/Edit button so it stands out as on mobile).

## When it shows
Same condition as mobile (`src/pages/Index.tsx` line 787):
- `task.status === 'in-progress'` or `task.status === 'paused'`

Hidden for `pending`, `completed`, `billed`, `paid`.

## What it does
Reuse the mobile stop logic 1:1 by porting `handleStopTimer` + `handleCompleteWork` from `src/pages/Index.tsx` (lines 269–376) into `DesktopDashboard.tsx`, and mount the existing `CompleteWorkDialog` at the bottom of the dashboard JSX (same props as `Index.tsx` lines 887–907).

Flow on click:
1. If `status === 'in-progress'`, close the running period (final `WorkPeriod` added to the active session), update task to `paused`, accumulate `totalTime`.
2. Open `CompleteWorkDialog` for that task (description, parts, per-period min-1hr flags, cloning/programming/add-key/all-keys-lost flags, follow-up).
3. On confirm → set task `status = 'completed'`, save sessions, clear `startTime`/`activeSessionId`, toast, then trigger background `syncPortalToCloud` (same as mobile).

## UI
Red destructive-style ghost button matching the existing icon buttons in that row:
```
<Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700"
        onClick={() => handleStopTimer(task.id)} title="Stop & Complete">
  <Square className="h-3.5 w-3.5 mr-1" />Stop
</Button>
```
Add `Square` to the `lucide-react` import on line 2.

## State to add in `DesktopDashboard`
- `showCompleteWork: boolean`
- `stoppingTaskId: string | null`

## Out of scope
No changes to mobile, no changes to `CompleteWorkDialog`, no changes to billing/sync logic — desktop just calls the same dialog and same update shape.
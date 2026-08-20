# Fix: two timers running at the same time

## What I found

Your data currently has two tasks in `in-progress` at once for Cornel Ungureanu (GMC Canyon and Tesla Model X), started 8 seconds apart.

Cause: not every "start" path pauses the currently running timer.

- The main start/restart handlers in the mobile/desktop dashboard do auto-pause — but they only look for **one** other running task (`find`), so if two are ever running, only one gets paused.
- The **Schedule "Start" button** (both mobile `ScheduleView` and `DesktopScheduleView`) creates a brand-new task with `status: 'in-progress'` and `startTime: now` and does **no** auto-pause at all. Starting a scheduled job while another timer runs leaves both running.
- Nothing re-checks on load, so once two are running they stay running forever, and every "pause/stop" helper that does `tasks.find(status === 'in-progress')` acts on an arbitrary one of them.

## The fix

1. **One shared start routine.** Extract the existing auto-pause + start logic into a single helper (e.g. `src/lib/timerControl.ts`) that:
   - finds **all** tasks with `status === 'in-progress'` (filter, not find),
   - closes each one's open period into its active session, adds elapsed to `totalTime`, sets `status: 'paused'`, clears `startTime`,
   - then starts the requested task.
2. **Route the schedule Start buttons through it.** `ScheduleView.handleStart` and `DesktopScheduleView.handleStart` will pause any running timers before handing the new task to `onStartTask`, instead of blindly creating a second running task.
3. **Self-heal on load.** On app start, if more than one task is `in-progress`, keep the most recently started one and auto-pause the rest (banking their elapsed time into their sessions so nothing is lost), with a toast explaining what happened.
4. **Fix the current data.** Pause the older of the two running tasks (the GMC Canyon, started 00:04:49) so only one timer remains live, preserving its elapsed time as a period on its active session.

## Technical notes

- Files touched: new `src/lib/timerControl.ts`; `src/pages/Index.tsx`, `src/pages/DesktopDashboard.tsx`, `src/components/ScheduleView.tsx`, `src/components/DesktopScheduleView.tsx`.
- Pause math reuses the existing pattern: `elapsed = (Date.now() - startTime) / 1000`, pushed as a `WorkPeriod` onto the active session, `totalTime += elapsed`.
- All updates applied through the existing `batchUpdateTasks` so pause + start land in one atomic write and cloud sync sees a consistent state.
- Step 4 is handled in-app by the self-heal on next load, so no manual database surgery is needed.

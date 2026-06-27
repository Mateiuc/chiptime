## Finding

Backend currently has Cory's task `7d65446c…` as **in-progress** with `startTime` and `activeSessionId` still set. Desktop is showing exactly what the backend has. So either mobile never pushed the stop, or another device (desktop) pushed a stale snapshot afterwards that overwrote mobile's stop.

User rule: **mobile is the master** — desktop must never overwrite mobile.

## Plan

### 1. Desktop becomes strictly read + targeted writes
- Keep `cloudPushEnabled = false` on desktop mount (already in place) so background autosaves never run.
- Remove/disable the "Save to Cloud" full-snapshot push button on desktop. Desktop will no longer push entire snapshots — that path is what can clobber a fresh mobile stop.
- Allow only narrow, intentional desktop writes (mark billed, mark paid, edit a single task) and route those through a per-task patch that re-pulls fresh data, applies the field change to that one task, and pushes — never sending stale `in-progress`/`startTime`/`activeSessionId` for tasks the desktop didn't touch.

### 2. Mobile push hardening (mobile = master)
- On Stop → Complete Work, await the task update and the immediate cloud push before closing the dialog, so the user sees confirmation only after the backend accepted the change.
- If the push fails, show an explicit "Not synced — retry" toast instead of silently queuing.

### 3. Desktop auto-refresh
- Pull on tab focus / visibility change and on a short interval (e.g. 60s) so mobile changes show up on desktop without manual reload.
- Pause auto-pull while an inline edit dialog is open to avoid disrupting the user.

### 4. Self-heal stuck "active" tasks on pull
- When desktop pulls, if a task has `status: in-progress` but its active session already has `completedAt` (or no `startTime` field server-side and a completed session), normalize the in-memory view to `completed`. This is display-only — no write back from desktop.
- Mobile, being master, can write a corrective update if the user re-opens the task.

### 5. One-time repair for Cory's stuck task
- From the mobile device, re-open Cory's task and tap Stop → Save again so mobile pushes the correct `completed` state. After that, desktop will reflect it on its next pull.

### 6. Verify
- Confirm in the backend that Cory's task flips to `completed`, `startTime` cleared, `activeSessionId` cleared.
- Confirm desktop active tab no longer lists Cory after auto-refresh.

## Out of scope
- No schema changes.
- No changes to billing/reports math.
- No mobile UI redesign.
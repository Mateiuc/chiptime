Place a worker chip on every session row in the desktop dashboard tree view, positioned on the right side of the row so it is easy to scan.

### What will change
- In `src/pages/DesktopDashboard.tsx`, the non-editing session list rows will show a colored `WorkerChip` with the worker's first name at the right end of each session row.
- The chip will be based on `session.createdBy` (fallback to task creator if missing).
- Size will be `sm` for readability, since it is the primary per-session label the user wants visible.
- The existing chips in the task header and inline editor remain unchanged.

### Where exactly
Lines ~1759-1773: the `<div className="flex items-center gap-2 text-xs flex-wrap">` that renders:
- Session N
- duration
- date range
- description
- badges (Min 1hr, Cloning, etc.)

We will wrap that line in a `justify-between` container so the worker chip sits at the far right of the session row.

### Technical details
- `useWorkers()` is already available in `DesktopDashboard`.
- `WorkerChip` already accepts `size="sm"`.
- No data model changes; `createdBy` is already stamped on sessions.
- Responsive handling: chip is `shrink-0` and the left content keeps `flex-wrap` so long rows wrap without overlapping.

### Out of scope
- No PDF/portal/client-side changes.
- No changes to inline editor or reports view.
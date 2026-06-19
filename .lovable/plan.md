## Problem

In the read-only desktop view, each session row shows `Jun 18, 5:31 PM → Jun 19, 12:43 AM`, but the edit dialog for the same session shows `06/18 04:23 PM → 06/18 07:20 PM`. The values disagree.

## Cause

In the previous change I rendered `formatSessionRange(session.createdAt, session.completedAt)`. Those two fields are *session lifecycle* timestamps (when the session row was created / when it was finalized) — not the actual time worked. The edit dialog (and the duration shown next to it) is driven by `session.periods[*].startTime / endTime`, which is the real work time.

So both views are technically "correct data" but they're showing different fields. The user expects the read-only view to match what they edit.

## Fix

Use the work-period times as the canonical session start → stop in the read-only view:

- **start** = earliest `period.startTime` across `session.periods`
- **end** = latest `period.endTime` across `session.periods` (or `…` if any period is missing endTime)
- If `session.periods` is empty, fall back to `session.createdAt` / `session.completedAt` so legacy/in-progress sessions still render something.

## Where

`src/pages/DesktopDashboard.tsx`, the session row render (the line that currently calls `formatSessionRange(session.createdAt, session.completedAt)`):

```tsx
const periodStart = session.periods.length
  ? new Date(Math.min(...session.periods.map(p => +new Date(p.startTime))))
  : session.createdAt;
const periodEnd = session.periods.length && session.periods.every(p => p.endTime)
  ? new Date(Math.max(...session.periods.map(p => +new Date(p.endTime))))
  : session.completedAt;
```

Then pass `periodStart, periodEnd` to `formatSessionRange(...)`. No change to `formatTime.ts`, no change to data model, no change to edit dialog, no change to mobile.

## Out of scope

- No changes to billing, durations, or stored data.
- No changes to the mobile view or the edit dialog.

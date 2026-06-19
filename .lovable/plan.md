Move the "Stop" button from the right-side action-buttons area in the desktop task header row to sit directly next to the status `Badge` (the "Paused" / "in-progress" pill). Keep the button styling as-is (`h-7 text-xs bg-red-600 …`) so its shape and text size match the badge height. Remove it from the far-right button group.

**File:** `src/pages/DesktopDashboard.tsx`
**Lines affected:** ~1607 (badge) and ~1629-1633 (current stop button location)

**What changes:**
1. In the left info area, right after the `<Badge>{task.status}</Badge>` (line 1607), insert the same conditional Stop button (`task.status === 'in-progress' || task.status === 'paused'`).
2. In the right action-buttons area (lines 1629-1633), remove that Stop button block — it should no longer render there.
3. No logic changes; `handleStopTimer(task.id)` stays the same.

**Out of scope:** No changes to `CompleteWorkDialog`, mobile view, or any other dashboard functionality.
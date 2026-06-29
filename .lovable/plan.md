## Problem
After selecting a job in the desktop Schedule view, the right pane shows the editor with no way to get back to the calendar overview. Clicking the same job again or clicking on whitespace doesn't deselect it.

## Fix
Single file: `src/components/DesktopScheduleView.tsx`.

Add a **"← Back to calendar"** button in the editor header (left side, before `selectionLabel`). Clicking it:
- If `dirty`, confirm "Discard unsaved changes?" first.
- Sets `selectedId = null` and `isDraft = false` → right pane re-renders the calendar overview.

Also make the left-list cards toggle: clicking the currently-selected card deselects it (same back-to-calendar behavior). This gives two intuitive ways back.

No other changes — calendar state (`previewDate`, `showUnscheduled`) is preserved because it lives on the component, so returning shows the same month/day the user was last on.

## Out of scope
Mobile schedule, editor layout, list styling.

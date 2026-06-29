## Goal
When no schedule entry is selected in the desktop Schedule view, the right pane currently shows an empty "No job selected" placeholder. Replace it with a calendar overview of scheduled cars.

## Change
Single file: `src/components/DesktopScheduleView.tsx` — replace the empty-state block (right pane when `!selectedId && !isDraft`) with a calendar layout.

### Right pane layout (when nothing selected)
Two stacked sections inside the right pane:

1. **Month calendar** (top, centered, ~max-w-md)
   - Uses existing `@/components/ui/calendar` (`react-day-picker`).
   - `mode="single"`, with internal state `previewDate` (defaults to today).
   - `modifiers`:
     - `hasJobs`: any day that has ≥1 entry in `visible` with a `scheduledAt`.
     - `overdue`: days strictly before today that still have pending entries.
   - `modifiersClassNames`:
     - `hasJobs`: bold text + small primary dot (via `after:` pseudo or ring).
     - `overdue`: orange ring/text matching existing overdue card styling.
   - A tiny legend below the calendar: dot = scheduled, orange = overdue, "Unscheduled (N)" chip if any entries have no `scheduledAt` — clicking the chip lists them in the section below.

2. **Day agenda** (below calendar)
   - Header: formatted long date for `previewDate` ("Mon, Jul 7") + count.
   - Scrollable list of that day's entries (sorted by time). Each row:
     - Time (HH:MM), client name, vehicle label, worker chip.
     - Clicking the row calls `handleSelectEntry(entry.id)` — switches the right pane into the existing editor.
   - Empty state for the day: "No jobs scheduled for this day." with a `+ Add` button that calls `handleNewDraft()` and pre-fills `dateStr` with the selected day (extend `handleNewDraft` to accept an optional default date).

### Derivation
Add a `useMemo` keyed on `visible`:
- `jobsByDay: Map<yyyy-mm-dd, ScheduleEntry[]>`
- `unscheduled: ScheduleEntry[]`
- Days arrays for `hasJobs` / `overdue` modifiers (built from `jobsByDay`).

### Out of scope
- Mobile `ScheduleView` — unchanged.
- No new components, no backend, no type changes, no styling overhaul of the existing editor pane or left list.
- Drag-to-reschedule is not included.

## Plan

### Scope
Single file: `src/components/DesktopScheduleView.tsx`.

### Change
Move the **"Calendar"** back-to-overview button from the sticky editor header (currently at the top-left before the title) into the bottom action bar, placing it to the left of the **Delete** button.

### Why
Keeps all navigation/exit actions grouped at the bottom near Save/Reset/Delete, matching the user's suggestion.

### Implementation
1. Remove the `Calendar` `<Button>` block from the header area (around line 572).
2. Insert the same button at the start of the bottom action bar (around line 711), before the conditional Delete button.
3. Keep the same behavior: if `dirty`, confirm "Discard unsaved changes?" before setting `selectedId = null` and returning to the calendar overview.

No other changes.
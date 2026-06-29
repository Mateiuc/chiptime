## Problem
The edit job still opens as a modal dialog on desktop, which looks bad. User wants the desktop schedule editor to follow the **Clients view pattern**: master-detail split, edit happens inline in the right pane — no popup at all.

## Fix

### 1. New component: `src/components/DesktopScheduleView.tsx`
Desktop-only schedule view with a 2-pane split layout (mirrors `DesktopClientsView`):

- **Left pane (~360px)**: scrollable list of schedule entries
  - Header: title + count + `+ Add` button
  - Each card: client name, vehicle, scheduled-when badge, requested-work preview, assigned worker chip
  - Clicking a card selects it (highlight). Clicking `+ Add` creates a new draft entry and selects it.
  - Compact VIN scan button + Start button on each card (same actions as mobile `ScheduleView`).

- **Right pane (flex-1)**: inline editor for the selected entry
  - If none selected → empty state ("Select a job to edit, or click + Add").
  - Otherwise renders the full form **inline as a Card** (not a Dialog):
    - Two-column grid: Client / Vehicle / Worker on left, Date+Time / Requested work / Notes on right.
    - New-vehicle inline sub-form spans full width when opened (reuses same logic).
    - Sticky footer in the card with Delete (left), Save / Cancel (right). Save commits; Cancel reverts unsaved edits or discards the draft.
  - Local draft state; "unsaved changes" indicator on Save button when dirty.

Reuses all existing handlers passed in (`onAdd`, `onUpdate`, `onDelete`, `onStartTask`, `onAddVehicle`, `onUpdateVehicle`) and the same `VinScanner` flow.

### 2. Wire it up in `src/pages/DesktopDashboard.tsx`
- Where `<ScheduleView ... />` is currently rendered for the desktop "schedule" view, swap it for `<DesktopScheduleView ... />` (same props).
- Mobile (`src/pages/Index.tsx`) continues to use the existing `ScheduleView` / `ScheduleEntryDialog` — unchanged.

### 3. Leave existing files alone
- `ScheduleEntryDialog.tsx` stays (still used by mobile).
- `ScheduleView.tsx` stays (still used by mobile).
- No logic changes to add/update/delete/start, no type changes.

## Out of scope
- Mobile schedule UI
- Any backend/sync changes
- VIN scanner internals

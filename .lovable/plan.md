

# Make "Min 1hr" a Per-Session Flag

## Current state
`chargeMinimumHour` is a task-level boolean. The user wants it **per-session** — each session independently decides whether to charge a minimum 1 hour.

## Changes

### 1. Update `WorkSession` type (`src/types/index.ts`)
Add `chargeMinimumHour?: boolean` to the `WorkSession` interface.

### 2. Update `EditTaskDialog.tsx`
- **Remove** the task-level `chargeMinimumHour` state and the Switch from the footer (lines 583-586).
- **Remove** `Switch` import.
- **Import** `Flag` from lucide-react.
- **Add a Flag icon button** in each session header (both mobile ~line 627 and desktop ~line 794), next to the Trash2 delete button. Clicking it toggles `session.chargeMinimumHour` in the sessions state.
- **Update `handleSave`**: remove task-level `chargeMinimumHour`; the flag is already stored per-session in the sessions array.

### 3. Update `TaskInlineEditor.tsx`
- Same change: remove task-level toggle from footer, add Flag icon per session header next to delete button.

### 4. Update billing/formatting logic
Wherever `task.chargeMinimumHour` is checked for billing calculations, update to check `session.chargeMinimumHour` per-session instead.

### Session header layout (both mobile & desktop):
```text
Session 1  [date badge]  [summary...]  [🚩] [🗑]
```

Flag filled + colored when active, outline + faded when inactive.

### Files to edit
- `src/types/index.ts` — add `chargeMinimumHour?: boolean` to `WorkSession`
- `src/components/EditTaskDialog.tsx` — per-session flag, remove footer toggle
- `src/components/TaskInlineEditor.tsx` — per-session flag, remove footer toggle
- Any billing logic files that reference `task.chargeMinimumHour` (need to search)


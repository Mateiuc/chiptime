## Goal
Add the photo strip + "Move to another task" action inside the desktop inline session editor (`TaskInlineEditor`), matching what already exists in `EditTaskDialog`. Today the desktop card (screenshot shows Lamborghini Urus → Task 1 → Session 1) has no way to view or move session photos, so the user is stuck when a photo was taken on the wrong session.

## Changes

1. **`src/components/TaskInlineEditor.tsx`**
   - Add props: `allTasks`, `clients`, `vehicles`, `onUpdateTask` (same shape passed to `EditTaskDialog`).
   - Sign photo URLs on mount for every photo in `sessions[].photos` via `photoStorageService` (same effect used in `EditTaskDialog`), keyed by `cloudPath`/`filePath`.
   - Inside each `<CollapsibleContent>` session block (right before "Work Periods"), render a thumbnail strip of `session.photos`. Each thumbnail shows:
     - the signed image (or camera placeholder while loading),
     - a small overlay button with the `ArrowRightLeft` icon → opens `MovePhotoDialog`.
   - When the move is confirmed, call the shared `moveSessionPhoto` helper against the freshest task list, then call `onUpdateTask` for the source task and (if different) the destination task so both persist immediately — same pattern as `EditTaskDialog`.
   - Also mirror the current-session state: strip the moved photo from local `sessions` when the source is this task, so the UI updates without waiting for a re-render from parent.

2. **`src/pages/DesktopDashboard.tsx`** (and any other caller of `TaskInlineEditor`)
   - Pass `allTasks`, `clients`, `vehicles`, and an `onUpdateTask` callback (the existing task-update path already used for saves) down to `TaskInlineEditor`. No new business logic — just prop wiring identical to what `EditTaskDialog` already receives.

## Out of scope
- No changes to storage, RLS, or the edge functions — photo binaries stay where they are; only the reference moves (same as the existing dialog implementation).
- No redesign of the session header or other editor sections.
- Mobile `EditTaskDialog` already has this; not touching it.
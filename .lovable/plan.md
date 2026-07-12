## Goal
Add a way, inside Edit Task, to move an individual photo from its current session to a session on **another task** (any task in the workspace). Fixes the "took the photo on the wrong session" case.

## UX
- In the Edit Task view (both `EditTaskDialog` and `TaskInlineEditor`), each photo thumbnail gets a small overlay menu button (⋯) with:
  - **View** (existing behavior)
  - **Delete** (existing behavior)
  - **Move to another task…** (new)
- Clicking "Move to another task…" opens a new `MovePhotoDialog` with:
  1. Search box + list of tasks (client + vehicle label, most recent first). Excludes the current task.
  2. After picking a task, a list of that task's sessions (date + summary). If the task has no sessions, offer "Create a session for this photo".
  3. Confirm button → performs the move, closes both dialogs, toast "Photo moved".

## Move operation (client-side, no schema change)
Photos live inside `WorkSession.photos[]` on tasks in local storage / sync. No DB migration needed.

Steps in a single storage transaction (via the existing `useStorage` update path):
1. Remove the photo object from the source session's `photos[]`.
2. Append the same photo object (unchanged `id`, `filePath`, `cloudUrl`, `cloudPath`, `capturedAt`) to the destination session's `photos[]`.
3. Persist both tasks (source + destination). If they're the same task, one write.
4. Bump `updatedAt` on both tasks so sync propagates.

No file re-upload: photo binaries in Supabase Storage / local filesystem are not moved — only the reference is reparented. `cloudPath` stays the same, so signed URLs keep working.

## Files touched
- **New**: `src/components/MovePhotoDialog.tsx` — task picker → session picker → confirm.
- `src/components/TaskCard.tsx` — photo thumbnail gets the ⋯ menu with "Move to another task…" entry (this is the shared thumbnail renderer used inside the edit views).
- `src/components/EditTaskDialog.tsx` and `src/components/TaskInlineEditor.tsx` — wire the move handler that opens `MovePhotoDialog` and calls the shared task-update function.
- `src/lib/` — small helper `movePhotoBetweenSessions(tasks, { photoId, fromTaskId, fromSessionId, toTaskId, toSessionId })` returning the updated tasks array, plus a unit test.

## Edge cases handled
- Destination task has no sessions → offer to create one (uses the same "add session" path already in Edit Task).
- Moving to the same session it's already in → button disabled.
- Photo not found (concurrent edit) → toast error, no-op.
- Sync: since both tasks bump `updatedAt`, existing app-sync/last-write-wins reconciles cleanly.

## Out of scope
- Multi-select move (move several photos at once).
- Moving photos across workspaces.
- Server-side move of the storage object (unnecessary — reference-only move is safe and instant).

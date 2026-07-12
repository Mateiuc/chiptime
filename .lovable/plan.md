## Add photo delete to session editors

Currently each photo thumbnail in the desktop inline editor and Edit Task dialog has only a "Move" (swap) button. Add a delete action next to it.

### Changes
- **`src/components/TaskInlineEditor.tsx`** and **`src/components/EditTaskDialog.tsx`**:
  - In `renderPhotoStrip`, add a small red trash-icon button on each thumbnail (top-left, opposite the move button).
  - On click: `window.confirm("Delete this photo?")`, then:
    - Remove the photo from the session's `photos` array.
    - Call `photoStorageService.deletePhoto(cloudPath)` (best-effort; ignore errors so a missing cloud file doesn't block local removal).
    - Persist via `onUpdateTask` immediately (same pattern as move).
  - Keep local-only photos (no `cloudPath`) working — just drop from the array.

### Not touched
- No changes to storage service, types, billing, or move logic.
- Bill PDF / sync pick up the removal automatically because they read from `session.photos`.

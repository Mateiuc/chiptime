## Status of the photo buttons in the edit views

Both buttons are wired and present in `src/components/TaskInlineEditor.tsx` (desktop inline editor) and `src/components/EditTaskDialog.tsx` (dialog editor). Nothing needs to be built — this is a status check for you before testing.

### Move button (top-right of each thumbnail)
- Icon: `ArrowRightLeft` in a small round chip.
- Only shown when the editor has workspace context (`allTasks`, `clients`, `vehicles`, `onUpdateTask`) — i.e. cross-task move is possible.
- Click → opens `MovePhotoDialog` for picking a destination task + session.
- Confirm → `moveSessionPhoto()` moves the photo, both source and destination sessions are marked photo-dirty, parent is updated via `onUpdateTask`, local draft mirrors the new photo arrays.
- Double-click guard: `movingPhotoKeyRef` blocks a second move of the same photo while one is in flight (prevents the duplicate-append bug we hit before).
- Uses stable ref keys (cloudPath / filePath / cloudUrl) so the same underlying file can't be appended twice.

### Delete button (top-left of each thumbnail)
- Icon: `Trash2` in a small round chip, red hover.
- Click → `window.confirm("Delete this photo? This cannot be undone.")`.
- On confirm:
  1. Removes the photo from the **source** session's `photos[]` by index (not by id), so duplicates don't collapse together.
  2. Merges the change into local draft + calls `onUpdateTask` so the parent state is authoritative.
  3. `isPhotoPathStillReferenced()` checks the whole workspace before calling `photoStorageService.deletePhoto(path)` — if any other session still references that storage path (e.g. after a copy/move), the file is kept in cloud storage.
  4. Toast: "Photo deleted".

### Render keys
- Thumbnails use `sessionId + refKey + index` so duplicates render as distinct nodes and delete-by-index targets the exact one you clicked.

### What to test
1. Move a photo across sessions and across tasks — confirm the source thumbnail disappears and the destination shows exactly one new thumbnail.
2. Delete a single photo among duplicates — only the clicked one should disappear; the others must remain.
3. Delete a photo that exists only on this session — the file should be removed from cloud storage too.
4. Delete a photo that was previously moved/copied and still exists on another session — the reference disappears here, the file stays in storage.

Ready for you to test — no code changes proposed.

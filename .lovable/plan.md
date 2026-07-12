## Fix: deleted photos reappear (and look duplicated) on the second delete

### Root cause
Both `TaskInlineEditor` and `EditTaskDialog` render photos from **local `sessions` state**, but photo delete/move is persisted immediately through `onUpdateTask` (which writes to the parent's task store). The two get out of sync:

1. Delete photo A → local `sessions` drops A, `onUpdateTask` writes new sessions to the parent.
2. Parent re-renders the editor with a fresh `task` prop, but the local `sessions` state is only seeded once (via `useState` initializer) and is never resynced from `task`.
3. As soon as any other update touches the parent's task list (cloud sync tick, another `updateTask`, part edit re-save, etc.), the parent's `task.sessions` and the editor's local `sessions` disagree on which photos exist. On the next photo delete, the write built from local `sessions` can re-introduce previously deleted photos — visually appearing as "photos come back / duplicated".

Photos are not something the editor should own in local draft state — they are already persisted immediately on move/delete. Everything else in local `sessions` (periods, parts, extra charge, flags) is only committed on Save, so it must stay local.

### Fix
Treat photos as a **live projection of `task.sessions`** rather than part of the local draft.

In both **`src/components/TaskInlineEditor.tsx`** and **`src/components/EditTaskDialog.tsx`**:

- In `renderPhotoStrip(session)`, look up photos from the current `task.sessions` by session id instead of the local `sessions` state:
  ```ts
  const livePhotos = task.sessions?.find(s => s.id === session.id)?.photos || [];
  ```
  Iterate `livePhotos` for thumbnails and move/delete buttons.

- In `handleDeletePhoto`, build `nextSessions` from `task.sessions` (parent source of truth), not from local `sessions`:
  ```ts
  const nextSessions = (task.sessions || []).map(s =>
    s.id === sessionId ? { ...s, photos: (s.photos || []).filter(p => p.id !== photo.id) } : s
  );
  onUpdateTask?.(task.id, { sessions: nextSessions });
  ```
  Also mirror the removal into local `sessions` state so any local unsaved edits keep their in-memory session objects consistent (photos array only):
  ```ts
  setSessions(prev => prev.map(s =>
    s.id === sessionId ? { ...s, photos: (s.photos || []).filter(p => p.id !== photo.id) } : s
  ));
  ```

- In `handleMoveConfirm` apply the same pattern: derive the source sessions from `task.sessions` for the write to parent, and only patch the `photos` arrays in local `sessions` state. This prevents the same drift for the move flow.

- Update the `allCloudPaths` memo used for signing URLs to read from `task.sessions` (so it always reflects the latest persisted photos and re-signs correctly right after a delete/move).

### Not changed
- Storage service, types, billing, sync, and PDF logic are untouched.
- Local draft behaviour for periods, parts, description, extra charge, and billing flags stays exactly as it is — only the photos slice is promoted to live prop-driven data.
- No visual/UX changes beyond the bug fix.

### Verification
- Open a task with ≥ 3 photos across one or more sessions.
- Delete photo 1 → confirm it disappears and does not come back.
- Delete photo 2 → confirm photo 1 stays gone, no duplicates appear.
- Move a photo to another task → source loses it, destination shows it once; repeat and confirm no reappearance.
- Reopen the editor and reload the app; deletions/moves persist.

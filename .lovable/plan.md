I understand — you did not delete them. The last code change can make moved photos disappear because it can overwrite the real photo list with stale editor state.

## Likely cause

The current delete/render logic still mixes two versions of the same session:

- `task.sessions`: the saved/current task data, where moved photos are added.
- local `sessions`: the editor draft, which can be stale after a move.

When moved photos are added, they can exist in `task.sessions` but not in local `sessions`. A later update can replace the saved photo list with the stale local list, making the moved photos disappear even though you never deleted them.

## Fix plan

1. **Make photos render from saved task data**
   - In both desktop inline editor and edit dialog, photo strips will read photos from `task.sessions` first.
   - This prevents moved photos from being hidden by stale local state.

2. **Make photo delete use saved task data only**
   - Delete will splice the clicked photo from `task.sessions`, not from local draft `sessions`.
   - Local draft state will be updated only after that, without overwriting the real photo list.

3. **Protect moved/duplicate photos in storage**
   - Before removing a physical image file, scan the updated saved sessions and other tasks.
   - If the same photo/path is still used anywhere, keep the file.

4. **Prevent future saves from wiping moved photos**
   - Add a merge step when saving/editing sessions so local changes to hours, parts, notes, and extra charge do not replace newer photos from `task.sessions`.

5. **Apply the same fix in both places**
   - `TaskInlineEditor.tsx`
   - `EditTaskDialog.tsx`

## Important recovery note

This fix prevents more photo references from disappearing. If the photos already disappeared from the saved task data, they may still be recoverable if they still exist in cloud storage or another device/backup, but the UI code alone cannot restore references it no longer has.
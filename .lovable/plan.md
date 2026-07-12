## Corrected plan

You are right: I will **not** add an automatic dedupe cleanup, and I will **not** remove any existing photo records. The real target is to stop the duplicate references from being created again, while preserving the 7 real photos that should exist in that session.

## What is causing the duplicates

The duplicate source is in the move/edit flow:

- A photo move writes photo changes immediately with `onUpdateTask`.
- The editor also keeps its own local `sessions` draft.
- After moving, both the saved task data and local draft can contain different versions of the photo lists.
- A later move/save/delete can merge the stale draft with saved data incorrectly and append/re-save the same photo reference again.
- The move helper currently appends to the destination every time and has no guard against “this same photo is already in destination”.

## Fix only the source

1. **Stop duplicate appends in the move helper**
   - Update `moveSessionPhoto` so it identifies the exact clicked photo by a stable reference key:
     - `id`
     - `filePath`
     - `cloudPath`
     - storage path derived from `cloudUrl`
   - Before appending to the destination session, check if that same photo reference already exists there.
   - If it already exists, remove it from the source only if needed, but do **not** append another copy.
   - If source session and destination session are the same, do nothing and return the task unchanged.

2. **Make move calls one-at-a-time**
   - Add a `movingPhotoKey` / busy guard in both editors.
   - While a move is running, ignore repeated confirm clicks for the same photo.
   - Clear the move dialog state after success so the same stale `movePhotoState` cannot be submitted again.

3. **Fix stale destination task reads**
   - In `handleMoveConfirm`, build the source task from the latest saved `task.sessions` plus safe local non-photo edits.
   - For cross-task moves, read the destination from `allTasks`, but do not merge old local photo state into that destination.
   - Persist source and destination updates as the result of one move operation.

4. **Fix save merge so it preserves saved photos only**
   - Keep the current goal: saving edited time/parts/description must not wipe moved photos.
   - But remove the dangerous path where a dirty local photo list can overwrite a newer saved photo list unless the user action was the active move/delete just completed.
   - Normal Save should keep `task.sessions[].photos` from the saved task and only save non-photo fields from the draft.

5. **Fix delete without physical storage deletion risk**
   - Delete only the clicked reference by index from the visible source list.
   - Do not delete the physical photo file unless no task/session references its path anymore.
   - Keep this as a delete action only; it will not run during move or save.

6. **No automatic cleanup**
   - No load-time dedupe.
   - No “clean duplicates” button.
   - No guessing whether 4, 7, or 10 photos are correct.
   - Existing data is left untouched unless you manually move/delete a specific thumbnail.

## Files to change

- `src/lib/movePhoto.ts`
  - Add stable photo reference comparison.
  - Prevent duplicate destination append.
  - No-op same-session moves.

- `src/components/TaskInlineEditor.tsx`
  - Add move busy guard.
  - Clear move state after success.
  - Make normal Save preserve saved photo arrays instead of writing stale draft photo arrays.

- `src/components/EditTaskDialog.tsx`
  - Apply the same move guard and save-photo preservation.

## Expected result

- Moving a photo cannot create duplicate thumbnails anymore.
- Saving edited task details cannot multiply photos or overwrite moved photos.
- The app will not delete or auto-clean any existing photo references.
- Your 7 intended photos remain under your control; only manual delete removes a specific thumbnail.
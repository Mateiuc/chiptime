## Plan

1. **Make photo deletion target one thumbnail, not every matching duplicate**
   - In both desktop inline editor and edit dialog, delete by a stable render key that includes session id + photo id + index/path.
   - This handles the current duplicate-photo situation where multiple thumbnails can share the same `photo.id`.

2. **Stop duplicate React keys from confusing the UI**
   - Replace `key={p.id}` in photo strips with a unique key per rendered thumbnail.
   - This addresses the console warning and prevents React from reusing the wrong thumbnail after delete.

3. **Persist deletion immediately without bringing photos back**
   - Build the updated task from the latest visible session data, remove only the selected photo instance, then call the existing task update persistence.
   - Mirror the same photo-only change into local editor state so pressing Save later does not restore deleted photos.

4. **Clean up stale signed URLs after delete**
   - Remove the deleted photo path from local signed-url cache when possible so stale thumbnails don’t remain visible.

5. **Validate**
   - Check that deleting repeated photos one-by-one removes the clicked thumbnail and does not duplicate or resurrect earlier deleted photos.
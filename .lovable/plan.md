

# Auto-Upload Photos to Cloud on Capture

## Problem
The `uploadPhotoToCloud` method exists in `photoStorageService` but is never called. When a photo is captured on the phone, it's saved locally only — `cloudUrl` is never set. The desktop dashboard then shows "on device only" for every photo.

## Fix

### `src/components/TaskCard.tsx` — Upload to cloud after local save

In `handleCapturePhoto`, after saving the photo locally and creating the `newPhoto` object, trigger a background cloud upload:

1. After `photoStorageService.savePhoto(...)` returns the `filePath`, also call `photoStorageService.uploadPhotoToCloud(base64, taskId, photoId)`
2. On success, set `cloudUrl` on the photo and update the task again
3. Do this in a fire-and-forget pattern (don't block the UI) — upload happens in background after the photo is saved locally
4. If upload fails, log a warning but don't show an error toast (photo is still saved locally)

```typescript
// After saving locally and updating the task:
// Background cloud upload
photoStorageService.uploadPhotoToCloud(photo.base64String, task.id, photoId)
  .then(cloudUrl => {
    // Update the photo with cloudUrl
    const taskWithCloudUrl = { ...updatedTask };
    taskWithCloudUrl.sessions = taskWithCloudUrl.sessions.map(session =>
      session.id === freshTask.activeSessionId
        ? { ...session, photos: session.photos?.map(p => 
            p.id === photoId ? { ...p, cloudUrl } : p
          )}
        : session
    );
    onUpdateTask?.(taskWithCloudUrl);
  })
  .catch(err => console.warn('[TaskCard] Cloud upload failed:', err));
```

### Files changed
- `src/components/TaskCard.tsx` — add background cloud upload after photo capture


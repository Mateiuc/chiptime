import { Task, SessionPhoto } from '@/types';
import { photoStorageService } from '@/services/photoStorageService';
import { indexedDB } from '@/lib/indexedDB';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { dlog } from '@/lib/devLog';
import { pluralize } from '@/lib/pluralize';

/**
 * Migrates existing photos from base64 storage in tasks to filesystem storage.
 * After migration, photos have filePath set and base64 is cleared.
 * 
 * This migration runs once on app startup and is idempotent.
 */
export async function migratePhotosToFilesystem(): Promise<{ migrated: boolean; photoCount: number }> {
  let photoCount = 0;
  let needsMigration = false;

  try {
    // Try to get tasks from capacitor storage first (primary), then indexedDB
    let tasks: Task[] = [];
    try {
      tasks = await capacitorStorage.getTasks();
    } catch {
      tasks = await indexedDB.getTasks();
    }

    // Check each task for photos that need migration
    const updatedTasks: Task[] = [];

    for (const task of tasks) {
      let taskModified = false;
      const updatedSessions = await Promise.all(
        task.sessions.map(async (session) => {
          if (!session.photos || session.photos.length === 0) {
            return session;
          }

          const updatedPhotos = await Promise.all(
            session.photos.map(async (photo) => {
              // If photo has base64 but no filePath, it needs migration
              if (photo.base64 && !photo.filePath) {
                needsMigration = true;
                photoCount++;

                try {
                  // Save to filesystem
                  const filePath = await photoStorageService.savePhoto(
                    photo.base64,
                    task.id,
                    photo.id
                  );

                  dlog(`[PhotoMigration] Migrated photo ${photo.id} to ${filePath}`);

                  // Return updated photo with filePath, no base64
                  taskModified = true;
                  return {
                    ...photo,
                    filePath,
                    base64: undefined, // Clear base64 to free up storage
                  } as SessionPhoto;
                } catch (error) {
                  console.error(`[PhotoMigration] Failed to migrate photo ${photo.id}:`, error);
                  // Keep original photo if migration fails
                  return photo;
                }
              }

              // Photo already migrated or has no data
              return photo;
            })
          );

          return {
            ...session,
            photos: updatedPhotos,
          };
        })
      );

      if (taskModified) {
        updatedTasks.push({
          ...task,
          sessions: updatedSessions,
        });
      }
    }

    // Save updated tasks back to storage
    if (updatedTasks.length > 0) {
      // Get fresh tasks and merge updates
      let currentTasks = await capacitorStorage.getTasks();
      
      const mergedTasks = currentTasks.map(task => {
        const updated = updatedTasks.find(u => u.id === task.id);
        return updated || task;
      });

      await capacitorStorage.setTasks(mergedTasks);
      dlog(`[PhotoMigration] Saved ${updatedTasks.length} updated tasks`);
    }

    if (needsMigration) {
      dlog(`[PhotoMigration] Migration complete: ${photoCount} photos migrated`);
    }

    return { migrated: needsMigration, photoCount };
  } catch (error) {
    console.error('[PhotoMigration] Migration failed:', error);
    return { migrated: false, photoCount: 0 };
  }
}

/**
 * Reconcile photos missing cloudPath by re-uploading them from local storage.
 * Native-only (web has no Capacitor filesystem). Idempotent: skips photos that
 * already have cloudPath, and uploadPhotoToCloud uses upsert.
 */
export async function reconcileCloudPhotos(): Promise<{ uploaded: number; failed: number }> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed = 0;

  try {
    const tasks = await capacitorStorage.getTasks();
    const updatedTasks: Task[] = [];

    for (const task of tasks) {
      let modified = false;
      const updatedSessions = await Promise.all(
        task.sessions.map(async (session) => {
          if (!session.photos || session.photos.length === 0) return session;
          const updatedPhotos = await Promise.all(
            session.photos.map(async (photo) => {
              if (photo.cloudPath) return photo;
              if (!photo.filePath) return photo;
              try {
                const base64 = await photoStorageService.loadPhoto(photo.filePath);
                if (!base64) return photo;
                const { url: cloudUrl, path: cloudPath } =
                  await photoStorageService.uploadPhotoToCloud(base64, task.id, photo.id);
                modified = true;
                uploaded++;
                return { ...photo, cloudUrl, cloudPath } as SessionPhoto;
              } catch (e) {
                failed++;
                console.warn('[PhotoReconciler] upload failed', photo.id, e);
                return photo;
              }
            })
          );
          return { ...session, photos: updatedPhotos };
        })
      );
      if (modified) updatedTasks.push({ ...task, sessions: updatedSessions });
    }

    if (updatedTasks.length > 0) {
      const current = await capacitorStorage.getTasks();
      const merged = current.map(t => updatedTasks.find(u => u.id === t.id) || t);
      await capacitorStorage.setTasks(merged);
      dlog(`[PhotoReconciler] Backfilled cloudPath on ${uploaded} photos across ${updatedTasks.length} tasks`);
    }
  } catch (e) {
    console.error('[PhotoReconciler] failed:', e);
  }

  return { uploaded, failed };
}

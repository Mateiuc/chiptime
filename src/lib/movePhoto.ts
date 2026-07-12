import type { Task, SessionPhoto } from '@/types';

export interface MovePhotoResult {
  source: Task;
  dest: Task;
}

const derivePathFromCloudUrl = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(/\/session-photos\/([^?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const normalizePhotoRef = (value?: string | null): string | null => {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

export function getSessionPhotoRefKeys(photo: SessionPhoto): Set<string> {
  const keys = new Set<string>();
  const id = normalizePhotoRef(photo.id);
  const filePath = normalizePhotoRef(photo.filePath);
  const cloudPath = normalizePhotoRef(photo.cloudPath);
  const derivedCloudPath = normalizePhotoRef(derivePathFromCloudUrl(photo.cloudUrl));
  const cloudUrl = normalizePhotoRef(photo.cloudUrl);

  if (id) keys.add(`id:${id}`);
  if (filePath) keys.add(`filePath:${filePath}`);
  if (cloudPath) keys.add(`cloudPath:${cloudPath}`);
  if (derivedCloudPath) keys.add(`cloudPath:${derivedCloudPath}`);
  if (cloudUrl) keys.add(`cloudUrl:${cloudUrl}`);

  return keys;
}

export function sessionPhotosShareReference(a: SessionPhoto, b: SessionPhoto): boolean {
  const aKeys = getSessionPhotoRefKeys(a);
  for (const key of getSessionPhotoRefKeys(b)) {
    if (aKeys.has(key)) return true;
  }
  return false;
}

/**
 * Move a single photo reference from a session on `sourceTask` to a session on
 * `destTask`. Returns updated copies of both tasks. Does NOT touch storage —
 * only the in-memory reference (id / filePath / cloudPath / cloudUrl) is
 * reparented. Bumps no external timestamps; callers should persist both tasks.
 *
 * When source and dest are the same task, the returned `source` and `dest`
 * point to the same updated object.
 */
export function moveSessionPhoto(
  sourceTask: Task,
  destTask: Task,
  photo: SessionPhoto,
  fromSessionId: string,
  toSessionId: string,
): MovePhotoResult {
  const sameTask = sourceTask.id === destTask.id;

  if (sameTask && fromSessionId === toSessionId) {
    return { source: sourceTask, dest: sourceTask };
  }

  // Find & extract photo from source
  let extracted: SessionPhoto | null = null;
  const strippedSourceSessions = (sourceTask.sessions || []).map(s => {
    if (s.id !== fromSessionId) return s;
    const photos = s.photos || [];
    const idx = photos.findIndex(p => sessionPhotosShareReference(p, photo));
    if (idx < 0) return s;
    extracted = photos[idx];
    const next = photos.slice();
    next.splice(idx, 1);
    return { ...s, photos: next };
  });

  if (!extracted) {
    throw new Error('Photo not found on source session');
  }

  const workingSessions = sameTask ? strippedSourceSessions : (destTask.sessions || []);
  const destSessionIdx = workingSessions.findIndex(s => s.id === toSessionId);
  if (destSessionIdx < 0) {
    throw new Error('Destination session not found');
  }

  // Renumber photo.sessionNumber to match destination's ordinal index (1-based)
  const rebadged: SessionPhoto = { ...extracted, sessionNumber: destSessionIdx + 1 };

  const updatedDestSessions = workingSessions.map((s, i) => {
    if (i !== destSessionIdx) return s;
    if ((s.photos || []).some(existing => sessionPhotosShareReference(existing, rebadged))) {
      return s;
    }
    return { ...s, photos: [...(s.photos || []), rebadged] };
  });

  const updatedSource: Task = { ...sourceTask, sessions: sameTask ? updatedDestSessions : strippedSourceSessions };
  const updatedDest: Task = sameTask ? updatedSource : { ...destTask, sessions: updatedDestSessions };
  return { source: updatedSource, dest: updatedDest };
}

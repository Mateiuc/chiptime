import type { Task, SessionPhoto } from '@/types';

export interface MovePhotoResult {
  source: Task;
  dest: Task;
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
  photoId: string,
  fromSessionId: string,
  toSessionId: string,
): MovePhotoResult {
  const sameTask = sourceTask.id === destTask.id;

  // Find & extract photo from source
  let extracted: SessionPhoto | null = null;
  const strippedSourceSessions = (sourceTask.sessions || []).map(s => {
    if (s.id !== fromSessionId) return s;
    const photos = s.photos || [];
    const idx = photos.findIndex(p => p.id === photoId);
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
    return { ...s, photos: [...(s.photos || []), rebadged] };
  });

  const updatedSource: Task = { ...sourceTask, sessions: sameTask ? updatedDestSessions : strippedSourceSessions };
  const updatedDest: Task = sameTask ? updatedSource : { ...destTask, sessions: updatedDestSessions };
  return { source: updatedSource, dest: updatedDest };
}

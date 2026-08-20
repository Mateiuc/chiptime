import { Task, WorkPeriod, WorkSession } from '@/types';
import { getCurrentUserId } from '@/lib/currentUser';

export type TaskUpdate = { id: string; updates: Partial<Task> };

/**
 * Build the updates needed to pause EVERY running task (optionally excluding one).
 * Any open period is banked onto the task's active session so no time is lost.
 * Uses `filter` (not `find`) so a corrupted state with 2+ running timers heals.
 */
export function buildPauseUpdatesForRunningTasks(
  tasks: Task[],
  excludeTaskId?: string
): { updates: TaskUpdate[]; pausedTasks: Task[] } {
  const running = tasks.filter(
    (t) => t.status === 'in-progress' && t.id !== excludeTaskId
  );

  const updates: TaskUpdate[] = [];
  const now = new Date();

  for (const task of running) {
    let updatedSessions: WorkSession[] = [...(task.sessions || [])];
    let activeSessionId = task.activeSessionId;

    if (!activeSessionId) {
      const newSession: WorkSession = {
        id: crypto.randomUUID(),
        createdAt: now,
        periods: [],
        parts: [],
        createdBy: getCurrentUserId() || undefined,
      };
      updatedSessions.push(newSession);
      activeSessionId = newSession.id;
    }

    let elapsed = 0;
    if (task.startTime) {
      const start = new Date(task.startTime);
      elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));

      const period: WorkPeriod = {
        id: crypto.randomUUID(),
        startTime: start,
        endTime: now,
        duration: elapsed,
        createdBy: getCurrentUserId() || undefined,
      };

      updatedSessions = updatedSessions.map((s) =>
        s.id === activeSessionId
          ? { ...s, periods: [...(s.periods || []), period] }
          : s
      );
    }

    updates.push({
      id: task.id,
      updates: {
        status: 'paused',
        sessions: updatedSessions,
        totalTime: (task.totalTime || 0) + elapsed,
        startTime: undefined,
        activeSessionId,
      },
    });
  }

  return { updates, pausedTasks: running };
}

/**
 * Self-heal: if more than one task is running, keep the most recently started
 * one and pause all the others. Returns [] when the state is already valid.
 */
export function buildSingleRunnerHealUpdates(tasks: Task[]): {
  updates: TaskUpdate[];
  pausedTasks: Task[];
} {
  const running = tasks.filter((t) => t.status === 'in-progress');
  if (running.length < 2) return { updates: [], pausedTasks: [] };

  const keep = [...running].sort((a, b) => {
    const at = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bt - at;
  })[0];

  return buildPauseUpdatesForRunningTasks(tasks, keep.id);
}

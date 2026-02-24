

# Fix: Immediate Portal Sync on Billed/Paid Status Changes

## Problem
When you mark a task as "billed" or "paid", the client portal in the cloud does NOT get updated. The `syncPortalToCloud` function is only called when completing a work session (in `handleCompleteWork`). So the portal keeps showing the old status until you complete another task for that client -- which could be 30+ minutes or never.

## Solution
Add a background `syncPortalToCloud` call inside `handleMarkBilled` and `handleMarkPaid` in `src/pages/Index.tsx`, identical to how it already works in `handleCompleteWork`.

## Changes

### `src/pages/Index.tsx`

**`handleMarkBilled` (line 402-405)** -- after updating the task status, trigger a portal sync:

```typescript
const handleMarkBilled = (taskId: string) => {
  updateTask(taskId, { status: 'billed' });
  toast({ title: 'Task Marked as Billed' });

  // Sync portal so client sees updated status immediately
  const task = tasks.find(t => t.id === taskId);
  const client = task ? clients.find(c => c.id === task.clientId) : null;
  if (client) {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: 'billed' as const } : t
    );
    syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate)
      .then(portalId => {
        if (!client.portalId) updateClient(client.id, { portalId });
      })
      .catch(err => console.warn('[CloudSync] Portal sync failed:', err));
  }
};
```

**`handleMarkPaid` (line 407-410)** -- same pattern:

```typescript
const handleMarkPaid = (taskId: string) => {
  updateTask(taskId, { status: 'paid' });
  toast({ title: 'Payment Recorded' });

  // Sync portal so client sees updated status immediately
  const task = tasks.find(t => t.id === taskId);
  const client = task ? clients.find(c => c.id === task.clientId) : null;
  if (client) {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: 'paid' as const } : t
    );
    syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate)
      .then(portalId => {
        if (!client.portalId) updateClient(client.id, { portalId });
      })
      .catch(err => console.warn('[CloudSync] Portal sync failed:', err));
  }
};
```

No other files need changes. The sync runs in the background and won't block the UI.


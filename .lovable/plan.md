

# Inline Task Editing — Replace Dialog with In-Place Expand

## What changes

When you click the pencil icon on a task in the desktop tree, instead of opening a fullscreen dialog, the task card itself expands to reveal the full editing UI (sessions, periods, parts, description) directly below the task header. Same pattern already used for inline client and vehicle editing.

## Files

### 1. New: `src/components/TaskInlineEditor.tsx`
Extract the desktop editing UI from `EditTaskDialog.tsx` into a standalone component — no Dialog wrapper. Includes:
- All state: `sessions`, `editingPeriod`, `expandedSessions`
- All handlers: period time changes, add/delete period, add/delete part, update part price/quantity, add/delete session, save
- Collapse All / Expand All toggle (already built)
- Collapsible session cards with periods table, parts table, description textarea
- Save / Cancel footer row
- Props: `task`, `onSave`, `onCancel`, `onDelete`, `clientName?`, `vehicleInfo?`

### 2. Edit: `src/pages/DesktopDashboard.tsx`
- Replace `editingTask: Task | null` state with `editingTaskId: string | null`
- Remove the `EditTaskDialog` render block (lines 819-832)
- Inside the task card (line 623), when `editingTaskId === task.id`, render `<TaskInlineEditor>` below the task header row
- Pencil button toggles `editingTaskId` instead of `setEditingTask`
- On save: call `updateTask`, clear `editingTaskId`
- On cancel: clear `editingTaskId`

### 3. Keep: `src/components/EditTaskDialog.tsx`
No changes — still used for mobile editing.

## Layout sketch

```text
┌─ Task Card ─────────────────────────────────────────┐
│ Task 1 · Jan 9 · in-progress · 01:12:00 · $45.00  ✏│  ← clicking ✏ expands below
│                                                      │
│ ┌─ Inline Editor ──────────────────────────────────┐ │
│ │ [Collapse All]                                    │ │
│ │ ▼ Session 1 · Jan 9                          [🗑] │ │
│ │   Period 1: [date][time] → [date][time]  00:30   │ │
│ │   Parts: brake pad ×2 = $30.00                   │ │
│ │   Description: [textarea]                        │ │
│ │                                                   │ │
│ │ [+ Add Session]         [Cancel]  [Save Changes] │ │
│ └───────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```


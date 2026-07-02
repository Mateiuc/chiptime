## Move Paid-date editor to the task row

Add the compact **Paid date** input directly in the task header row on the Desktop Dashboard (right after the `📷 N` photo count, next to the camera icon area circled in the screenshot), instead of hiding it inside the Edit dialog.

### Change

- In `src/pages/DesktopDashboard.tsx`, task header row (around line 1761), when `task.status === 'paid'` (and desktop-only which it already is): render
  - Small label "Paid:"
  - `<input type="date">` bound to `task.paidAt` (empty allowed).
  - `onChange` calls `updateTask(task.id, { paidAt: value ? new Date(value+'T12:00:00') : undefined })` → registers as unsaved change, "Save (N)" pulses; Reports pick it up after Save.
  - Compact styling to match neighboring badges (`h-6 text-xs`).
- Remove the duplicate Paid-date row from `src/components/EditTaskDialog.tsx` header so there's only one place to edit it.

### Files touched

- `src/pages/DesktopDashboard.tsx` — inline paid-date input on paid task rows.
- `src/components/EditTaskDialog.tsx` — remove the header Paid-date row added earlier.

### Not touched

- Mobile, Reports math, deposits, mark-as-paid auto-fill.

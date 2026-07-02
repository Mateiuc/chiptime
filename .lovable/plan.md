## Add manual "Paid date" editor (desktop only)

### DB verified (double-checked)

Listed every key present on the 184 paid tasks across all workspaces. Only 12 keys exist: `id, clientId, vehicleId, carVin, customerName, status, totalTime, needsFollowUp, sessions, createdAt, createdBy, diagnosticPdfUrl`. No `paidAt` under any alternate name (`paid_at`, `paidOn`, `datePaid`, etc.), and no `depositApplied`. So the paid date genuinely does not exist for any historical task.

### Change

Desktop-only manual editor:

- In `src/components/EditTaskDialog.tsx`, when `task.status === 'paid'`, show one compact **Paid date** row: `<Input type="date">` bound to `paidAt`. Empty allowed (clears the value). Saves through the existing update path.
- Nothing on mobile.
- No changes to Reports, deposits, or the auto-set-on-mark-paid behavior.
- No auto-backfill.

### Files touched

- `src/components/EditTaskDialog.tsx` — single date field, only visible when task is paid.


# Workspace-shared data, worker permissions, and Schedule module

Three connected pieces. Invite-code flow stays as-is.

## 1. Shared workspace data (the foundation)

Today each user has their own local store and pushes a personal snapshot to `app_sync`. A "member" doesn't actually see the admin's cars.

Change sync to be keyed per **workspace** instead of per user:

- `appSyncService` reads/writes `app_sync` row where `workspace_id = current workspace`, not per-user.
- On first load for a new member, mobile pulls the workspace snapshot once, then continues with its normal auto-push on every mutation.
- Desktop keeps its manual Reload / Save model — same code path, just scoped to the workspace row.
- Conflict model stays "last write wins" (already accepted). Each task / session / period already carries `createdBy`, so attribution survives.
- One-time migration script in-app: when a user opens the app and their personal `app_sync` row has data but the workspace row is empty, copy it over.

Every worker on mobile then sees and can work on every car in the workspace, in real time across devices (after their next push).

## 2. Worker (non-admin) permissions

UI-level gates only — RLS stays as today since all data flows through the single workspace `app_sync` row.

Workers **can**:
- View every client, vehicle, task, session, photo, part in the workspace
- Add new clients and vehicles (stamped with `createdBy = their uid`)
- Start / pause / stop work on **any** car, add sessions, photos, parts, notes
- Use Settings → Camera, Notifications, OCR, Backup/Restore (all per-device, already local)

Workers **cannot** (hidden / disabled in UI):
- Edit or delete clients / vehicles / tasks they didn't create
- Mark Billed / Mark Paid (admin/owner only)
- See Workspace member management beyond their own nickname
- See global billing rate settings, payment methods, portal branding (admin/owner only)
- Invite codes screen (admin only — already the case)

Add a tiny `useCanEdit(item)` helper: `isAdmin || item.createdBy === currentUserId`. Apply to Edit / Delete buttons across `TaskCard`, `EditTaskDialog`, client/vehicle lists, desktop dashboard rows.

## 3. Schedule module (mobile + desktop)

New top-level tab "Schedule" alongside Active / Completed / Billed / Paid.

A schedule entry holds:
- Client (pick existing or quick-add)
- Vehicle (pick existing or quick-add — VIN optional at this stage)
- Requested work (free text — what the client asked for)
- When (optional date+time, or "unscheduled")
- Assigned worker (optional — defaults to "anyone")
- Status: `scheduled` → `started` → (auto-archived once the resulting Task is closed)

Actions on each entry:
- **Start** button → creates a real Task for that client+vehicle, copies the requested-work text into the first session description, starts the timer, marks the schedule entry as `started` and links it to the new task id. Same behaviour on mobile and desktop.
- Edit / reschedule / delete (admin or creator)

Storage: a new `schedule` array inside the same workspace snapshot — no new table needed, rides on the existing sync. Sorted by date, with an "Unscheduled" group at the top.

## Technical notes

- `src/services/appSyncService.ts` — switch key from user-scoped to `workspace_id`-scoped row; add one-time personal→workspace import.
- `src/types/index.ts` — add `ScheduleEntry` type and `schedule: ScheduleEntry[]` on the root data shape.
- `src/lib/permissions.ts` (new) — `useCanEdit`, `useIsAdmin` helpers reading from `AuthContext.workspace.role`.
- `src/pages/Index.tsx` + `src/pages/DesktopDashboard.tsx` — new Schedule tab, list, add/edit dialog, Start handler.
- `src/components/ScheduleEntryDialog.tsx` (new) — add/edit form reusing existing Client/Vehicle pickers.
- `src/components/SettingsDialog.tsx` / `DesktopSettingsView.tsx` — hide admin-only sections (rates, payments, portal, members) when role is `member`.
- `src/components/TaskCard.tsx`, `EditTaskDialog.tsx`, client/vehicle lists — gate Edit/Delete buttons via `useCanEdit`.
- No DB schema migration required (`app_sync` already has `workspace_id`); confirm and adjust RLS policy only if the current one scopes by `user_id`.

## Out of scope (explicit)

- No changes to invite-code flow.
- No worker editing of others' data.
- No calendar grid view in v1 — just a chronological list with date headers. Calendar can come later if you want.

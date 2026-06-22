## Goal

Attribute work to the team member who did it, and show it everywhere on the desktop UI (task cards, sessions, parts, work periods) — but never on the client portal or PDFs.

## 1. Data model (types only, no DB migration)

App data already lives in one shared `app_sync` row per workspace, so no new tables. Add optional `createdBy?: string` (user UUID) to:

- `Task` — who created the task
- `WorkSession` — who started that session
- `WorkPeriod` — who ran that timer interval
- `Part` — who added the line item

All optional; old data without it falls back to "you" (see §5 migration).

## 2. Worker registry & colors

New helper `src/lib/workers.ts`:

- `useWorkers()` hook — loads `profiles` for every `user_id` in `workspace_members` of the current workspace (reuse query pattern from `WorkspaceManager`).
- `getWorkerDisplay(uid)` → `{ firstName, color }`.
  - `firstName` = first token of `display_name`, else email local-part, else "—".
  - `color` = deterministic HSL from `uid` hash (same algorithm as `sessionColors.ts`), cached per workspace so each member keeps the same hue across reloads.
- Provider at `App.tsx` level so every desktop view shares one fetch.

## 3. Stamping on write

Wherever we currently create/append these objects, stamp `createdBy = auth user id`:

- `Index.tsx` / `DesktopDashboard.tsx` task creation
- start/resume session, push new `WorkPeriod` on timer start
- add part in `EditTaskDialog` / `TaskInlineEditor`

A small helper `stampAuthor<T>(obj)` injects `createdBy` from `useAuth().user.id`.

## 4. UI — colored first-name chip

New component `src/components/WorkerChip.tsx`:

```
[●Alex]   ← rounded pill, bg = worker.color @ 15%, text = worker.color, dot = solid
```

Sizes: `sm` (cards) and `xs` (inline in session lists).

Placements (desktop only, hidden on `ClientPortal.tsx` and PDF renderers):

- **TaskCard / DesktopDashboard row** — chip next to customer name showing the task's `createdBy`; if active session belongs to a different member, also show that member's chip with a small "● live" dot.
- **EditTaskDialog / TaskInlineEditor**
  - Each session header: chip for session author
  - Each work period row: chip + time range
  - Each part row: small chip after the part name
- **DesktopReportsView**
  - New "Worker" filter dropdown (All / per member)
  - Itemized table gains a "Worker" column showing the chip
  - Summary header gains per-worker totals: `Alex 12h $420 · Sam 4h $140`

Explicitly NOT touched: `ClientPortal.tsx`, `billPdfRenderer.ts`, `ShareBillDialog.tsx` outputs.

## 5. Backfill for existing data

On first load after this change, in the storage migration step (`storageMigration.ts` or a new tiny one):

- For every Task/Session/Period/Part missing `createdBy`, set it to the current `auth.uid()`.
- Save once, mark a flag `worker_attribution_v1` in localStorage so it doesn't run twice.

## 6. Out of scope

- No PDF / portal changes
- No reassignment UI (can't change who did past work)
- No per-worker rates
- No DB migration; everything lives in the existing synced JSON blob

## Technical notes

- Color algorithm: `hue = hash(uid) % 360`, `hsl(hue 70% 45%)` for text/dot, `hsl(hue 70% 45% / .15)` for bg — matches existing token style.
- All new chips read from one `WorkersContext` to avoid N profile queries.
- Reports filter is purely client-side over the already-loaded tasks.

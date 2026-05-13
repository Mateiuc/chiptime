# Codebase Audit — Read-Only

Scope: 21,963 LOC across `src/` and `supabase/functions/`. No code modified. Each finding is triaged P0 / P1 / P2 with file:line and a one-line fix hint.

> Headline: the largest real risks are (a) **multiple parallel implementations of the labor/min-hour math** outside `billing.ts` — the exact "single source of truth" violation the audit asks about — and (b) a `formatCurrency` that quietly ceils its input, which compounds with allocated-discount fractions to produce off-by-one drift between portal/PDF/desktop totals. Everything else is hygiene.

---

## P0 — fix immediately

| # | Cat | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | 3 Math | `src/pages/DesktopDashboard.tsx:563, 579, 624`; `src/components/DesktopClientsView.tsx:86`; `src/components/SettingsDialog.tsx:206`; `src/components/ManageClientsDialog.tsx:132, 174`; `src/components/TaskCard.tsx:716–725`; `src/lib/clientPortalUtils.ts:220–229`; `src/lib/billPdfRenderer.ts:76–86` | At least 9 sites reimplement labor + min-hour math instead of calling `computeSessionLabor` / `computeTaskTotal`. Any divergence (rounding, period-vs-session min-hour precedence, services) silently desyncs Desktop vs Portal vs PDF vs Mobile. | Route every surface through `billing.ts`. Delete local `periods.reduce + Math.ceil + chargeMinimumHour` blocks. |
| 2 | 3 Math | `src/lib/formatTime.ts:9–15` (`formatCurrency`) | `formatCurrency` calls `Math.ceil(amount)` on the input. When called on fractional values (allocated discount remainders in `computeTaskTotalAllocated`, or `Math.max(0, total - deposit)` where total was already ceiled but discount is float) the displayed sum can exceed the true sum by ±$1 per task. Reports/Desktop use allocated; Portal sums per-task — they will drift. | Remove the `Math.ceil` from `formatCurrency`; ceil deliberately at the math layer instead. |
| 3 | 3 Math | `src/pages/DesktopDashboard.tsx:582, 627`; `src/components/DesktopClientsView.tsx:89` | Min-hour adjustment formula is duplicated WITHOUT the `hasPeriodFlags` guard that `billing.ts:65–69` and `clientPortalUtils.ts:221` use. Tasks with per-period min-hour flags will get **double-charged** here (period bump + session bump). | Either delete and use `computeSessionLabor`, or add `!hasPeriodFlags &&` guard. |
| 4 | 14 Sec | `src/lib/clientPortalUtils.ts:742, 746, 750` | Self-hosted client portal HTML uses `innerHTML = h` and string-concatenated `<img src="...">` for user-supplied photo URLs and PIN-decrypted text. `esc()` is defined but the lightbox `render()` interpolates `urls[ci]` directly into HTML. | Switch to `textContent` / `setAttribute('src', ...)` and validate URL is `https://*.supabase.co`. |
| 5 | 14 Sec | `supabase/functions/get-portal/index.ts:90` | `code !== data.access_code` is plain string compare — vulnerable to timing side channels at the edge. | Use a constant-time compare (length check + xor loop). |
| 6 | 7 Race | `src/services/appSyncService.ts:60–68`; `src/hooks/useStorage.ts:39` | `pushToCloud` upserts the whole `data` blob without an ETag/version check. The 1.5 s debounce + last-write-wins design means two open tabs (or desktop + mobile while on same workspace) overwrite each other. The recent "race-clobbered cloudPath" incident is the symptom. | Add `If-Match`-style version column on `app_sync` (`data_version int`) and bump+compare in upsert; or move per-entity sync. |
| 7 | 6 Async | `src/components/TaskCard.tsx:619`; `src/pages/Index.tsx:65, 377, 486, 505`; `src/pages/DesktopDashboard.tsx:426, 439` | Multiple fire-and-forget `.then()` chains without `.catch()`. If portal sync, photo upload, or diagnostic upload throws, the rejection is unhandled and the user sees nothing. | Add `.catch(e => { console.error(...); toast({ variant:'destructive', ... }) })` on each. |
| 8 | 11 Backend | `supabase/functions/get-portal/index.ts`; `supabase/functions/sync-portal/index.ts`; `sign-photo-urls`; `sign-diagnostic-url`; `upload-photo`; `upload-diagnostic` | All edge functions return `Access-Control-Allow-Origin: *` and have no per-IP rate limit. `get-portal` does PIN brute-force protection per portal, but a swarm of fresh portal IDs can still scrape. | Restrict CORS to `chiptime.chipplc.one` + lovable preview hosts; rely on Supabase rate limit or add Upstash counter on `get-portal`. |

---

## P1 — wrong/inconsistent, fix soon

| # | Cat | File:line | Issue | Fix |
|---|---|---|---|---|
| 9 | 2 Stale | `src/types/index.ts:102` | `WorkSession.chargeMinimumHour` marked `@deprecated - use session.chargeMinimumHour instead` — comment refers to itself. Real intent: per-period flag is the new path, session flag is legacy. | Rewrite comment; or remove field once all writers migrate. |
| 10 | 2 Stale | `src/components/TaskCard.tsx:735` | Comment says "Phase 1: ignore task.billedAmount / task.importedSalary entirely" — but adjacent code at line 764 explicitly reads `task.importedSalary`. Comment is a lie. | Delete comment; add accurate "Phase 2" note. |
| 11 | 8 TS | strict-mode TSC surfaces 16 errors (3 in `DesktopClientsView.tsx:187`, 13 in `VinScanner.tsx`) — all "possibly null" on `selectedClient`, `canvas`, `video`. | Guard with `if (!canvas) return` etc. Currently silently masked because `tsconfig.app.json` has `"strict": false, "noImplicitAny": false`. |
| 12 | 1 Dead | `src/hooks/useStorage.ts:66` (`cloudSyncEvents`); `src/lib/formatTime.ts:51` (`formatDateTimeForInput`); `src/lib/billPdfLayout.ts:40` (`safeArea`); `src/types/index.ts:1, 29, 89, 134` (`Client`, `Vehicle`, `Task`, `Settings` — flagged by ts-prune as unused exports, but they're consumed via `import type` indirection — verify before deleting); `src/integrations/lovable/index.ts:12` (`lovable`). | ts-prune output. Delete or wire up. |
| 13 | 4 Strings | `src/components/DesktopReportsView.tsx:265` `"Others (${rest.length} vehicles)"`; `src/pages/DesktopDashboard.tsx:964, 1344` `"clients"` / `"vehicles"`; `src/lib/photoMigration.ts:102, 162` photo counts | No singular handling — "1 vehicles", "1 photos". | Add tiny `pluralize(n, sing, plur)` helper. |
| 14 | 4 Strings | `src/components/TaskCard.tsx:355, 369` use `'Customer'` as fallback; rest of UI uses `Client`. | Pick one term — codebase otherwise uses **Client**. |
| 15 | 4 Strings | `src/lib/billPdfRenderer.ts` produces "Bill" PDFs; `src/components/DesktopInvoiceView.tsx` produces "Invoice" PDFs. Two different documents, but UI uses both terms interchangeably (e.g. TaskCard.tsx:485 `"Invoice saved as ..."` for what is actually a Bill). | Decide: Bill = retail receipt, Invoice = formal billing doc. Document the distinction in `billPdfRenderer.ts` header. |
| 16 | 5 Links | `src/lib/clientPortalUtils.ts:5` hardcodes `https://chiptime.chipplc.one`; `:819, :860` hardcode `https://${projectId}.supabase.co/functions/v1/get-portal`. | Move to env. Already broken if portal moves to a new domain. |
| 17 | 6 Async | `src/services/appSyncService.ts:29` writes `localStorage` synchronously after a successful push — no try/catch around `localStorage.setItem` (quota error in Safari private mode crashes sync). | Wrap in try/catch. |
| 18 | 7 Race | `src/hooks/useStorage.ts:8` `pushTimer` is a **module-level** singleton — works for one mount, breaks if multiple `useStorage` consumers ever co-exist (none right now, but the singleton is a footgun for HMR + Strict Mode double-mount). | Move to a ref or a small `pushQueue` service. |
| 19 | 9 Console | 40+ `console.log` survive in prod paths: `appSyncService.ts:76,95,108`, `useStorage.ts:13,32,330,366,374,391`, `Index.tsx:60,65,67,102`, `photoMigration.ts:51,98,102,162`, `cloudSyncService.ts`, `contactsService.ts` (12 logs). | Gate behind `import.meta.env.DEV` or a `debug` namespace. |
| 20 | 10 Magic | `src/lib/billPdfRenderer.ts` contains many bare numbers (Y offsets at 198, 329, 534, 554; widths 215.9 / 279.4 in `DesktopInvoiceView.tsx:87`). Margins live in `billPdfLayout.ts` but lots leaked back into renderers. | Move to named constants in `billPdfLayout.ts`. |
| 21 | 11 Backend | `app_sync` table has no `DELETE` policy at all (good — append-only), but also no index on `workspace_id`. With one row per workspace this is OK now, but RLS does a sequential scan per call. | Add `CREATE INDEX ON app_sync(workspace_id)` once row count grows. |
| 22 | 12 UX | `src/components/EditTaskDialog.tsx:538–555` uses an inline "Yes/No" toggle for delete (not an AlertDialog). Inconsistent with `ManageClientsDialog.tsx:888, 925` which use AlertDialog for the same destructive verb. | Standardize on AlertDialog. |
| 23 | 12 UX | `src/pages/Index.tsx:715, 718` icon-only Buttons have no `aria-label` (only 6 `aria-label` occurrences across the entire UI). | Add `aria-label` to every `size="icon"` Button. |
| 24 | 14 Sec | `src/lib/clientPortalUtils.ts:668` `tryDecrypt(pin).then(...)` inside generated portal HTML has no `.catch` — a malformed PIN throws and the portal hangs on the "decrypting" state. | Add `.catch` that resets the form. |

---

## P2 — nits / polish (grouped)

**Cat 1 (dead code, ~6):** ts-prune false-positives aside, real candidates: `formatDateTimeForInput`, `cloudSyncEvents`, `lovable` integration stub, `safeArea`. Plus `src/types/contact-picker.d.ts` only used in one file.

**Cat 4 (strings, ~5):** Mixed casing — "PAID IN FULL" vs "Paid in full" appears at `ClientCostBreakdown.tsx:478` (`BALANCE DUE:`) vs other places that use sentence case. Currency symbol is always `$` via `Intl.NumberFormat('en-US', 'USD')` — consistent.

**Cat 7 (state):** `useEffect` deps look reasonable on spot-check; no obvious missing-dep bugs in `Index.tsx`, `DesktopDashboard.tsx`, `TaskCard.tsx`. Several effects use `[]` intentionally for mount-only — accept.

**Cat 8 (TS, ~30):** `as any` count: `appSyncService.ts:8`, `DesktopDashboard.tsx:8`, `DesktopReportsView.tsx:7`, `googleDriveService.ts:5`, `Auth.tsx:5`, `xmlConverter.ts:5`, `xlsImporter.ts:5`, `billing.ts:5`, `VinScanner.tsx:5`. Mostly at JSON-parse / Supabase data boundaries — acceptable but worth typing the sync payload.

**Cat 9 (debug, ~5):** Two stale comments at `src/services/contactsService.ts:196, 201` referencing "(XXX) XXX-XXXX" placeholder format — fine, they're docs.

**Cat 10 (magic numbers, ~10):** `useCloudSync.ts:185` `setTimeout` delay; `DesktopDashboard.tsx:189` `50 * 60 * 1000` poll interval; `pages/ClientPortal.tsx:30` `1000` — name them.

**Cat 12 (UX, ~8):** Loading skeletons missing on `DesktopReportsView` charts (data is local so latency is ~0, low priority); no aria-labels on chart elements; `ContactCombobox.tsx:86` uses generic "Could not load contacts" with no actionable next step.

**Cat 13 (perf, ~6):** `ClientCostBreakdown.tsx` and `DesktopReportsView.tsx` recompute `totalLabor` etc. on every render with no `useMemo` — fine for current dataset, would matter at 500+ tasks. `TaskCard.tsx` (1076 LOC) is a re-render hotspot — splitting into smaller children + `React.memo` would help.

**Cat 14 (sec, ~3):** `localStorage` used for sync timestamps and workspace ID — not tokens, OK. Supabase auth uses its own session storage.

---

## Verified clean (no findings)

- **No `debugger` statements** anywhere.
- **No `@ts-ignore` / `@ts-expect-error`** anywhere.
- **No `dangerouslySetInnerHTML`** outside the shadcn `chart.tsx` (intentional).
- **No `BgMode` / `paintBillBackground('decorative'|'clean')`** — fully migrated to `PageRole`.
- **No `legacyLockedTotal`** anywhere.
- **No "Photo on device only" / "Image could not be loaded" placeholder strings.**
- **`importedSalary` reads** are confined to `billing.ts` short-circuit, `clientPortalUtils.ts` short-circuit, the `ImportedBadge` chip predicates in `DesktopDashboard.tsx:1505` / `TaskCard.tsx:764` / `DesktopReportsView.tsx:189, 280`, XML I/O, and the XLS importer assignment. **No leak into other math paths.**
- **`billedAmount`** only appears in (a) `billing.ts` doc comment, (b) `capacitorStorage.ts` legacy strip, (c) `xmlConverter.ts` import drop. Clean.
- **All five tables have RLS policies** (`app_sync`, `client_portals`, `workspace_invites`, `workspace_members`, `workspaces`).

---

## Suggested fix order if you want a phased follow-up

1. **P0 #1 + #3** — collapse all labor math into `billing.ts`. One PR, mechanical.
2. **P0 #2** — strip `Math.ceil` from `formatCurrency`. Audit callers: most already pass integers.
3. **P0 #4 + #5** — portal HTML XSS hardening + constant-time PIN compare. Same file, one PR.
4. **P0 #6** — add `data_version` column on `app_sync` and CAS upsert. Migration + service edit.
5. **P0 #7** — add `.catch` + toast to every fire-and-forget. Mechanical sweep.
6. P1 batch — terminology, pluralization, env-ize URL, AlertDialog for EditTaskDialog delete.
7. P2 batch — when convenient.

Tell me which P0 / P1 items to take next and I'll plan the implementation.

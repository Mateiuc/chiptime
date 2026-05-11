# Phase 1 — Unify Billing Math

## Goal

Eliminate the $850 / $500 / $350 trilemma. Today the desktop task header, desktop vehicle rollup, and the client portal each compute totals differently because they handle legacy `billedAmount` / `importedSalary` inconsistently. After Phase 1, every surface routes through one shared utility and ignores those legacy fields entirely.

## New file

**`src/lib/billing.ts`** — pure functions, no React, no storage:

- `computeSessionLabor(session, client, settings)` → `{ labor, services, total }`
  - Hourly rate: `client.hourlyRate ?? settings.defaultHourlyRate ?? 0`
  - Per-period min-hour rule (existing `WorkPeriod.chargeMinimumHour`) and per-session min-hour (`WorkSession.chargeMinimumHour`) preserved exactly as `calcPeriodCost` + current portal math
  - Service fees from boolean flags (`isCloning`, `isProgramming`, `isAddKey`, `isAllKeysLost`) × matching client/settings rate fallback

- `computeTaskTotal(task, client, settings)` → `{ labor, services, parts, total }`
  - Sums `computeSessionLabor` across `task.sessions`
  - Parts: `price × quantity`, with `providedByClient` counted as $0
  - **Never reads `task.billedAmount` or `task.importedSalary`.** Status does not branch the math.

- `computeVehicleTotal(vehicle, tasksForVehicle, client, settings)` → `{ labor, services, parts, discount, total }`
  - Sums `computeTaskTotal` across the vehicle's tasks
  - Applies `applyLaborDiscount` once at the vehicle level on `(labor + services)`; parts are not discounted
  - `total = max(0, labor + services − discount) + parts`

## Call sites to replace

All three of these currently disagree on the same data — they will all return identical numbers after this change.

| File | Current | After |
|---|---|---|
| `src/pages/DesktopDashboard.tsx` `getTaskCost` (~L788) | reads `billedAmount`, applies discount, adds parts | `computeTaskTotal(task, client, settings).total` (vehicle-level discount applied where the rollup is computed) |
| `src/pages/DesktopDashboard.tsx` `getTaskCostGross` (~L823) | returns `billedAmount` directly | `computeTaskTotal(...).total` |
| `src/pages/DesktopDashboard.tsx` vehicle rollup / Grand Total / client revenue (L859, L945, L994) | sums `billedAmount` / `importedSalary` | `computeVehicleTotal(...).total` |
| `src/lib/clientPortalUtils.ts` `calculateClientCosts` (L186–L290, including the locked-pool branch) | proportional split of `billedAmount` across sessions | per-session labor from `computeSessionLabor`; per-task total from `computeTaskTotal`; vehicle total from `computeVehicleTotal` |
| `src/components/TaskCard.tsx` (~L1393–L1400 and the per-session helpers at L402, L810) | branches on `importedSalary` / `billedAmount` | `computeTaskTotal(...).total` for the header; `computeSessionLabor` for per-session lines |
| `src/components/DesktopReportsView.tsx` (L144–L150) | reads `billedAmount` / `importedSalary` | `computeTaskTotal(...).labor + .services` for labor analytics |
| `src/components/ManageClientsDialog.tsx` (L131, L177) | sums `importedSalary` | `computeTaskTotal(...)` aggregation |
| `src/pages/DesktopDashboard.tsx` charts at L315, L382 | per-task / per-session labor branches | `computeTaskTotal` / `computeSessionLabor` |

## Out of scope (Phase 2+)

- Do **not** delete `task.billedAmount` or `task.importedSalary` from `Task` type, XML import/export (`xmlConverter.ts`), or `xlsImporter.ts`.
- Do **not** change the writes in `handleMarkBilled` (Index.tsx L469, DesktopDashboard.tsx L700). The field is still written; it is just no longer read by the calculation path.
- Do **not** touch the legacy reconcile/warning badge in `ClientCostBreakdown.tsx` (~L393–396).
- Do **not** change the Cost/Due label in `TaskCard.tsx` (~L1534).
- Do **not** change rounding behavior — reuse `calcPeriodCost`'s `Math.ceil(minutes/60 * rate)` exactly.

## Verification

For the Lamborghini "Ali's" task (`status=billed`, `billedAmount=500`, 1 session of 1 second, 1 part Battery $350) the total must read **$350** at all six surfaces:

1. Desktop task header (TaskCard)
2. Desktop vehicle rollup
3. Desktop Grand Total / client revenue card
4. Client portal Billed-tab vehicle card
5. Client portal Grand Total
6. Mobile task card

For the Mercedes GLS (Lance Naidoo) the total computes live from sessions + parts + vehicle discount, with no reference to `billedAmount`.

After the change, `rg "billedAmount|importedSalary" src` should show reads only in:
- `xmlConverter.ts` (backup import/export)
- `xlsImporter.ts` (write only)
- `Index.tsx` / `DesktopDashboard.tsx` `handleMarkBilled` (write only)
- `ClientCostBreakdown.tsx` legacy badge (Phase 3 will remove)
- `clientPortalUtils.ts` portal-payload serialization (kept so legacy badge can still detect mismatch — flagged for Phase 3)

## Deliverable in the build phase

- Files changed list with a one-line description of each replacement
- Side-by-side before/after totals for the Lamborghini at all six surfaces
- Confirmation that no calculation path reads `billedAmount` or `importedSalary` (search output included)

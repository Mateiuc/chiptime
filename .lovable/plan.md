# One billing engine. Every screen reads from it.

Goal: **every number** shown to a user — chip totals, vehicle totals, client totals, PDF rows, portal rows, reports rows, invoice rows — comes from `src/lib/billing.ts`. No surface adds, multiplies, rounds, or discounts on its own.

## The contract (in `src/lib/billing.ts`, already exists)

| Need | Call | Returns |
|---|---|---|
| Per-session labor breakdown (line items in a bill) | `computeSessionLaborDetails(session, client, settings)` | base / minHourAdj / cloning / programming / addKey / allKeysLost / labor / services / total |
| Per-session billable parts (skips `providedByClient`) | `computeSessionParts(session)` | number |
| Per-task raw total (no discount) | `computeTaskTotal(task, client, settings)` | labor / services / parts / total |
| Per-task chip total (allocated share of vehicle discount) | `computeTaskTotalAllocated(task, vehicle, allVehicleTasks, client, settings)` | labor / services / parts / discount / total |
| Per-vehicle total (pooled discount, single ceil) | `computeVehicleTotal(vehicle, vehicleTasks, client, settings)` | labor / services / parts / discount / total |
| Per-client total | **sum of `computeVehicleTotal` across that client's vehicles** | — |
| Rates with client overrides → settings fallback | `resolveRates(client, settings)` | 5 rates |
| Dollar rounding | `ceilDollars(n)` | int |
| Time (seconds → minutes → dollars) | `calcPeriodCost(seconds, hourly)` | int |

Anything not in this table is **off-limits** to surface code.

## Banned in surface code (search-and-destroy)

- `duration / 3600` or `duration / 60` — must go through `calcPeriodCost` (which `computeSessionLabor` already uses).
- `Math.ceil(...)` on a money amount — use `ceilDollars`.
- Local `formatCurrency` / `formatDuration` — import from `@/lib/formatTime`.
- `(settings as any).default*Rate` — use `resolveRates`.
- Reading `client?.hourlyRate || settings.defaultHourlyRate` inline — use `resolveRates`.
- Reading `part.price * part.quantity` directly — use `computeSessionParts`.
- Applying `vehicle.discountValue` inline — use `applyLaborDiscount` or `computeVehicleTotal`.
- Aggregating client totals from tasks directly — sum `computeVehicleTotal` instead, so PDF rows and PDF total always reconcile.

## Files to clean (one pass each)

1. **`src/pages/DesktopDashboard.tsx`** — `getTaskCost` → `computeTaskTotalAllocated(...).total`. `getVehicleStats` → `computeVehicleTotal`. Any inline labor/parts math out.
2. **`src/components/DesktopReportsView.tsx`** — `getTaskCost` → `computeTaskTotalAllocated`. Itemized rows → `computeSessionLaborDetails` + `computeSessionParts`. Recharts data points → same.
3. **`src/components/TaskCard.tsx`** (mobile chip) — total → `computeTaskTotalAllocated`. Time → `task.sessions.flatMap(s=>s.periods).reduce(... .duration)` formatted with `formatDuration`.
4. **`src/components/TaskInlineEditor.tsx`** — any live-preview cost → `computeTaskTotal` (preview, no vehicle context yet) or `computeTaskTotalAllocated` if vehicle known.
5. **`src/pages/ClientPortal.tsx`** + **`src/lib/clientPortalUtils.ts`** — replace local cost helpers with `computeVehicleTotal` per vehicle, sum for client total. Keep only PIN/format helpers.
6. **`src/components/DesktopInvoiceView.tsx`** — when sourced from tasks, route through `computeTaskTotalAllocated` + `computeVehicleTotal`. Manual-entry mode untouched.
7. **`src/components/DesktopClientsView.tsx`** + **`src/components/ManageClientsDialog.tsx`** — confirm last pass's `clientFinancials.ts` wiring is the only path; delete any leftover inline math, local `formatCurrency`/`formatDuration`, and the $0 hourly-rate fallback bug.
8. **`src/lib/billPdfRenderer.ts`** + **`src/lib/billPdfLayout.ts`** — line items: `computeSessionLaborDetails`; parts: `computeSessionParts`; vehicle subtotal: `computeVehicleTotal`. No local math.
9. **`src/lib/clientFinancials.ts`** — keep as the legacy-shape adapter for PDF callers, but make `aggregate` call `computeTaskTotal` per task (already does for the most part) so there's literally one math path.

## Verification (must all hold after the pass)

- For any vehicle V with tasks T₁…Tₙ and a discount:
  `sum(computeTaskTotalAllocated(Tᵢ, V, T, client, settings).total) ∈ [computeVehicleTotal(V,...).total, computeVehicleTotal(V,...).total + (n-1)]`
  (documented ceil bias; chips never under-report vs. vehicle total).
- For any client C: `clientTotal = Σ computeVehicleTotal(V, ...)` across C's vehicles — same number on dashboard, portal, PDF, reports.
- An imported task (`importedSalary` set) shows `importedSalary` as its total on every surface, regardless of sessions/parts.
- A `providedByClient: true` part contributes **$0** to parts on every surface.
- A period with `chargeMinimumHour: true` and `duration < 3600` charges `ceilDollars(hourly)` once; never double-bumped with session-level flag.

## Tests added to `src/lib/__tests__/billing.test.ts`

- **Cross-surface invariant**: build a fixture client with 2 vehicles (one with a 15% discount, one with a $25 amount discount, mixed imported + normal + providedByClient parts). Assert:
  - `sum(computeTaskTotalAllocated.total)` per vehicle ∈ `[vehicleTotal, vehicleTotal + n-1]`.
  - Client total = sum of `computeVehicleTotal.total`.
  - Imported task ignores its parts/sessions.
  - providedByClient parts excluded.

## Out of scope

- No discount model change (pooled, allocated per task — same as today).
- No UI redesign.
- No DB / type changes.
- No new helpers — everything needed already exists in `billing.ts`.

## Files touched

Code: 9 files listed above. Tests: 1 file. Net effect: ~400 lines of duplicate math deleted; every screen pulls from one engine.

## Audit findings (summary)

The codebase has **one canonical billing engine** in `src/lib/billing.ts` (`computeTaskTotal`, `computeVehicleTotal`) and **5 inline re-implementations** scattered across surfaces. Mobile (`TaskCard`) and Reports (`DesktopReportsView`) use the canonical engine. Desktop tree, Desktop Clients, ManageClientsDialog, and the client PDF generator each re-roll the math — and each diverges from canonical in different ways.

### Critical bugs found
1. **`DesktopClientsView` falls back to $0 hourly rate** when client has no override (should fall back to `settings.defaultHourlyRate`). Most clients have no override, so most clients show $0 labor in this view.
2. **All 4 inline `getClientFinancials` / `getVehicleFinancials` ignore `importedSalary`** — XLS-imported tasks are mis-totaled or zeroed in client PDFs.
3. **All 4 inline copies ignore `providedByClient: true` parts** — inflates parts revenue with client-supplied parts.
4. **All 4 inline copies skip per-period `chargeMinimumHour` flags** — only check the legacy session-level flag.
5. **All 4 inline copies use raw `duration / 3600`** — no minute rounding (canonical engine rounds to the nearest minute via `calcPeriodCost`).
6. **Vehicle discount applied two different ways**: client portal pools all task labor then discounts once; desktop chips discount each task separately. For percentage discounts on multi-task vehicles, the per-task path systematically over-rounds.
7. **`DesktopDashboard.getTaskCost` is missing `Math.ceil`** — produces fractional-dollar chip labels; `DesktopReportsView.getTaskCost` ceils correctly.
8. **Mobile `handleCompleteWork` doesn't stamp `createdBy` on parts** (desktop does).
9. **`TaskCard` settings prop typed as `{ defaultHourlyRate: number }`** — the 4 service rates are accessed via unsafe `(settings as any)` casts.

### Dead code
- `Task.chargeMinimumHour` (deprecated, no readers — only `WorkSession.chargeMinimumHour` is live)
- Local re-declarations of `formatCurrency`/`formatDuration` in `DesktopClientsView` and `ManageClientsDialog`
- 4 `getClientFinancials`/`getVehicleFinancials` blocks that only exist to feed `generateClientPDF`

---

## Refactor plan

### Step 1 — Centralize the client-PDF totals
Make every `generateClientPDF` in the codebase call the same source-of-truth helpers:

- `DesktopDashboard.generateClientPDF` → use `calculateClientCosts(client, vehicles, tasks, settings, ...)` for per-client totals and `computeVehicleTotal` for per-vehicle rows.
- `DesktopClientsView.generateClientPDF` → same.
- `ManageClientsDialog.generateClientPDF` → same.

Delete the local `getClientFinancials` / `getVehicleFinancials` blocks (~200 lines removed) and the local `formatCurrency` / `formatDuration` re-declarations.

### Step 2 — Align discount application
Decide once: discount is a **vehicle-level pool**, not per-task. Change `DesktopDashboard.getTaskCost` and `DesktopReportsView.getTaskCost` to display per-task labor un-discounted, and show the vehicle discount on the vehicle row only (which `computeVehicleTotal` already produces). The chip total for a task becomes its raw labor + parts; the vehicle subtotal shows the pooled discount.

If the user prefers to keep per-task discount badges in the UI, instead document this and remove the pooled path from `computeVehicleTotal` / `calculateClientCosts` so all surfaces agree. **I need your call on this — see clarifying question below.**

### Step 3 — Fix `getTaskCost` rounding
Add `Math.ceil` (or use the existing `ceilDollars` helper) to `DesktopDashboard.getTaskCost` so chip dollars match Reports and the printed bill.

### Step 4 — Fix worker attribution on mobile
In `Index.tsx handleCompleteWork`, stamp `createdBy` on each part before assigning (`parts.map(p => p.createdBy ? p : { ...p, createdBy: getCurrentUserId() || undefined })`), matching the desktop handler.

### Step 5 — Tighten `TaskCard` settings type
Replace `{ defaultHourlyRate: number }` with a `Pick<Settings, ...all 5 rates>` so the `(settings as any)` casts disappear and the compiler catches future omissions.

### Step 6 — Delete dead code
- Remove `Task.chargeMinimumHour` from the `Task` type and any leftover writers.
- Remove the 4 inline finance helpers and 2 local format helpers after Step 1.

### Step 7 — Verify
After each step, manually check three spots:
- Desktop chip on a task with a `percent` vehicle discount.
- Client-PDF totals for an imported (XLS) task.
- Client-PDF totals for a task with `providedByClient: true` parts.

---

## Clarifying questions before I implement

1. **Discount semantics** — when a vehicle has a 10% discount and 3 tasks, do you want:
   - **(A)** Discount shown only on the vehicle subtotal (pooled, the way the client portal does it today), OR
   - **(B)** Discount shown per-task chip (current desktop behavior, slightly over-rounded)?

2. **Rollout** — implement all 7 steps now, or split into two passes (bug fixes first, dead-code removal second)?

3. **Backwards compatibility** — any in-the-wild bills/PDFs you've already sent that you want preserved bit-for-bit? If yes, I'll skip Step 2 and only fix the bugs in Step 1, 3, 4.
# Tier B — Math Correctness (Revised)

## Item 1 — `formatCurrency` + `ceilDollars` helper

### A. `src/lib/formatTime.ts`
Strip `Math.ceil` from `formatCurrency`; it becomes a pure display formatter:
```ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
```

### B. New helper in `src/lib/billing.ts`
```ts
/** Round dollar amount up to next whole dollar (billing-conservative). */
export function ceilDollars(amount: number): number {
  if (!isFinite(amount)) return 0;
  if (amount <= 0) return 0;          // clamp negatives → $0
  return Math.ceil(amount);
}
```
Centralizes the rounding rule. Negative-clamp policy documented inline.

### C. Apply `ceilDollars` at math-layer sites that emit potentially-fractional display values
- `computeTaskTotalAllocated`: ceil `taskDiscount` and recompute `total` from the ceiled discount. JSDoc note: per-task discount sum may exceed the vehicle discount by up to `(taskCount - 1)` dollars — intentional billing-conservative bias.
- `computeVehicleTotal.discount`: ceil so vehicle-level display matches.
- Any post-deposit subtotal at call sites: wrap final value in `ceilDollars` defensively even though inputs are already integers.
- `billPdfRenderer` totals/subtotal: pass already-integer helper outputs straight to `formatCurrency`. No extra ceiling needed.

### D. Audit every `formatCurrency(...)` call site
For each, document the math path and confirm input is an integer (or wrap once at the math layer):
- `ClientCostBreakdown.tsx` — uses `computeTaskTotalAllocated.{discount,total}` → integers after C.
- `DesktopReportsView.tsx` — Mix card / monthly buckets sum `computeVehicleTotal.total` → integer; final `formatCurrency` only.
- `DesktopDashboard.tsx` — vehicle rollup + Grand Total via `computeVehicleTotal` / sum of `computeTaskTotal.total`.
- `billPdfRenderer.ts` — line totals via `computeSessionLabor.total`, vehicle subtotal via `computeVehicleTotal`.
- `TaskCard.tsx` — uses `computeSessionLabor` / `computeTaskTotal` → integers.
- `ClientPortal` photo / cost display — uses `computeTaskTotalAllocated` / `computeVehicleTotal`.
- `SettingsDialog` rate preview — wrap synthetic preview value in `ceilDollars` before format.
- Anywhere else the audit surfaces: same pattern (math-layer ceil, format displays).

## Item 2 — Consolidate labor math through `billing.ts`

Replace inline `periods.reduce` + `chargeMinimumHour` blocks with `computeSessionLabor` / `computeTaskTotal` / `computeVehicleTotal`:

1. `src/pages/DesktopDashboard.tsx` L563/579/582 + L624/627 — vehicle rollup + per-task cost. L582 & L627 lack the `hasPeriodFlags` guard → P0 #3 double-charge. Replace blocks with helpers.
2. `src/components/DesktopClientsView.tsx` L86–89 — same unguarded bug. Replace with `computeTaskTotal`.
3. `src/components/ManageClientsDialog.tsx` L132 + L174 — per-client revenue calc, also unguarded. Replace with `computeTaskTotal`.
4. `src/components/SettingsDialog.tsx` L206–207 — rate preview. Synthesize a one-period mock `WorkSession` and call `computeSessionLabor`, OR add `previewSessionLabor(durationSec, hourly, opts)` to `billing.ts` if that's cleaner.
5. `src/components/TaskCard.tsx` L716–725 — replace with `computeSessionLabor(session, client, settings)`.
6. `src/lib/clientPortalUtils.ts` L220–229 — replace with `computeSessionLabor`. Reuse `resolveRates` instead of re-deriving rates.
7. `src/lib/billPdfRenderer.ts` L75–86 — replace per-line labor with `computeSessionLabor`; subtotal/totals via `computeVehicleTotal` / `computeTaskTotal`.

Invariants preserved:
- `computeTaskTotal` short-circuits to `importedSalary` when set; amber "Imported" badge remains.
- Vehicle discount applies to `labor + services` pool only (parts excluded).

## Item 3 — Tests

### `src/lib/__tests__/billing.test.ts` (new)

**`computeSessionLabor`**
- Single full-hour period → `hourly`.
- Sub-hour period with `period.chargeMinimumHour` → `Math.ceil(hourly)`.
- Multiple mixed-duration periods.
- Sub-hour session with `session.chargeMinimumHour=true` and no period flag → bumps to 1h.
- **P0 #3 regression**: sub-hour with both `period.chargeMinimumHour=true` AND `session.chargeMinimumHour=true` → bump applies once (period level).
- Service flags additive: cloning + programming + addKey + allKeysLost.

**`computeTaskTotal`**
- `importedSalary` short-circuits even with sessions/parts present.
- Sums labor / services / parts across sessions.
- Skips `providedByClient` parts.

**`computeTaskTotalAllocated` & `computeVehicleTotal`**
- Even-weight allocation: discount $100, weights 0.4/0.35/0.25 → $40/$35/$25, sum = $100.
- Uneven allocation: discount $100, weights 0.33/0.33/0.34 → ceiled to $34/$34/$34, sum $102. Assert: each allocation is an integer; sum ≤ input + (taskCount − 1).
- Negative effective labor clamps to 0; parts still added.
- Zero-pool vehicle → zero discount, parts pass through.

**`ceilDollars`**
- `ceilDollars(0) === 0`
- `ceilDollars(0.1) === 1`
- `ceilDollars(99) === 99`
- `ceilDollars(99.4) === 100`
- `ceilDollars(-0.5) === 0` (negative-clamp policy)
- `ceilDollars(NaN) === 0`, `ceilDollars(Infinity) === 0`

**`formatCurrency`**
- `formatCurrency(0) === "$0"`
- `formatCurrency(99) === "$99"`
- `formatCurrency(100) === "$100"`
- `formatCurrency(1500) === "$1,500"`
- `formatCurrency(99.4) === "$99"` (Intl rounds; production path won't hit fractional inputs because `ceilDollars` runs at math layer)
- `formatCurrency(99.6) === "$100"`

Existing race tests untouched — confirm Tier A 12 tests still pass.

## Verification

1. `bunx vitest run` — all green (race + service + new billing).
2. Build / TS clean after migrations.
3. Cross-surface 10×3 manual table for Mercedes GLS, Lamborghini Ali's, small in-progress task. Halt on any mismatch.
4. Imported-task spot check: `importedSalary` honored on TaskCard / Desktop / Portal / PDF; amber badge present.
5. P0 #3 regression: real task with both period-level and session-level `chargeMinimumHour` flags → single bump (`Math.ceil(hourly)`); compare to pre-fix to confirm bug existed.
6. Fractional-discount real bill ($591 across ~10 mixed-weight tasks):
   - Each per-task displayed discount is an integer.
   - Sum of per-task discounts ≥ raw vehicle discount (over-allocation = billing-conservative).
   - Grand Total = sum(per-task total) − deposit, displays correctly.

## Out of scope

- No DB migration; no UI/flag-model changes; no CI wiring.

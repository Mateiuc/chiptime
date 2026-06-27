## Goal
Add a "Print" button on the client portal for each vehicle, placed between the VIN and the price, that downloads a PDF using the existing bill renderer.

## Approach — minimal changes
Instead of duplicating the bill renderer, reconstruct a synthetic `Task` from the portal's pre-computed `VehicleCostSummary` and pass it to the existing `renderBillPdf`. This keeps the change small and preserves the exact bill appearance.

## Plan

### 1. Synthetic data helper
Create a small mapping function (≤ 30 lines, can live in `ClientCostBreakdown.tsx` or a tiny `src/lib/portalToTask.ts`):
- Takes a `VehicleCostSummary`.
- Returns a `Task` with synthetic `WorkSession`s where:
  - `periods` are built from `SessionCostDetail.periods`.
  - `parts` are copied directly.
  - `description` is copied.
  - `chargeMinimumHour`, `isCloning`, `isProgramming`, `isAddKey`, `isAllKeysLost` are inferred from whether the corresponding pre-computed cost is > 0.
- Also returns a reconstructed `Vehicle` and `Client` from the summary.

### 2. Button in `ClientCostBreakdown.tsx`
- Import `Printer` from `lucide-react` and `renderBillPdf` from `@/lib/billPdfRenderer`.
- In the vehicle accordion header, add a small print icon button between the VIN area and the price area.
- `onClick`:
  1. Build the synthetic `Task` / `Client` / `Vehicle` for this car.
  2. Call `renderBillPdf({ task, client, vehicle, settings: { defaultHourlyRate: /* estimated from laborCost/duration or fallback 0 */ } })`.
  3. `doc.save('bill-{vehicleName}-{date}.pdf')`.
  4. Toast "Bill PDF saved".
- Use `e.stopPropagation()` so clicking print does not toggle the accordion.

### 3. Settings / rate fallback
- The existing renderer needs a `defaultHourlyRate`. Derive it from the first session where `duration > 0` as `baseLabor / (duration/3600)`, or default to `0`. Since all costs are pre-computed, the rate is only used by `computeBillTotals` as a fallback; the inferred flags should make the recalculated costs match the portal values when rates are unchanged.

## Files touched
- `src/components/ClientCostBreakdown.tsx` — add button + mapping logic.
- Optionally `src/lib/portalToTask.ts` — if the mapping is extracted.

## Out of scope
- No changes to `src/lib/billPdfRenderer.ts` or `src/lib/billPdfLayout.ts`.
- No new full renderer.
- No changes to edge functions or portal data model.
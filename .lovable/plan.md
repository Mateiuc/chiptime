## Per-Vehicle Labor Discount

Add an optional discount on each vehicle that reduces only the **labor** portion of its tasks. Parts and deposits remain unchanged. Income everywhere (cards, PDFs, reports) reflects the discounted labor.

### 1. Data model — `src/types/index.ts`
Extend `Vehicle`:
- `discountType?: 'fixed' | 'percent'`
- `discountValue?: number` (dollars if fixed, 0–100 if percent)

No DB migration needed — vehicle data lives inside `app_sync.data` JSON.

### 2. Edit / Add Vehicle UI
Files: `EditVehicleDialog.tsx`, `AddVehicleDialog.tsx`, `AddVehiclePage.tsx` (and the desktop equivalents in `DesktopClientsView.tsx` if present).

Add a **Labor Discount** group below the Deposit field:
- Toggle/segmented control: `$` | `%`
- Numeric input bound to a string state (per project rule)
- Helper text: "Applied to labor only. Parts and deposit are unaffected."
- Validate: percent 0–100, fixed ≥ 0, never produces negative labor (clamp to 0).

### 3. Discount math — new helper `src/lib/formatTime.ts` (or new `src/lib/discount.ts`)
```ts
applyLaborDiscount(labor: number, vehicle?: Vehicle): {
  discount: number;     // amount removed (rounded up)
  laborAfter: number;   // max(0, labor - discount)
}
```
Rules:
- `percent`: `discount = ceil(labor * value / 100)`
- `fixed`: `discount = min(value, labor)`
- Returns `{0, labor}` when no discount set.

### 4. Apply in totals
- **`TaskCard.tsx`** (line 1367–1369): wrap `laborCost` with `applyLaborDiscount` before computing `totalCost`. Show a "Discount" line in the bill summary block (lines 1645–1656) when > 0, between labor and deposit.
- **`ClientCostBreakdown.tsx`** (lines 148, 182, 319, 370): subtract discount from each session's effective labor in the per-vehicle aggregation. Show a discount row per vehicle.
- **`DesktopReportsView.tsx`** and **`DesktopDashboard.tsx`**: apply the same helper wherever `laborCost`/income totals are summed so analytics match.
- **PDF / share bill** paths in `TaskCard.tsx` (around lines 671, 687, 874, 1096, 1128) — include a "Discount" line and use the discounted total before subtracting deposit.
- **Client portal** (`clientPortalUtils.ts`): include discount in the rendered breakdown so client view matches.

### 5. Display rules
- Card: small italic line "Discount −$X" under the Cost row when applicable.
- PDF/printed bill: explicit row `Labor Discount  −$X` between Subtotal and Deposit.
- Reports: discount reduces "Income" / labor revenue; parts revenue unchanged.

### Out of scope
- No per-session or per-client discounts.
- No retroactive change to `task.billedAmount` for already-billed tasks (locked totals stay as-is).
- No DB schema change.

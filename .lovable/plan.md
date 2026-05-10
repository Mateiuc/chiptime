## Make labor discount visible everywhere

The discount math already runs in `applyLaborDiscount`, but three render paths never added a "Discount" line, so the customer (and you) only see a smaller total with no explanation. The mobile bill PDF and the mobile TaskCard summary already show it correctly — this plan brings the desktop bill PDF, the client portal, and the desktop task line up to parity.

### 1. Desktop bill PDF — `src/pages/DesktopDashboard.tsx` (`generateBillPdf`, lines 298–470)

- Compute `{ discount, laborAfter } = applyLaborDiscount(laborCost, vehicle)` (skip when `task.billedAmount != null` — locked).
- Use `laborAfter + partsCost` as the new `total`.
- In the totals block (lines 452–469), when `discount > 0`:
  - Render a green "Discount:" (or "Discount (X%):" when `discountType === 'percent'`) line with `-$amount`, placed between Subtotal and Deposit.
  - Shift `yPos` upward the same way the mobile PDF does (one extra 7-unit line per visible row).
- Keeps the layout identical when no discount is set.

### 2. Client portal data — `src/lib/clientPortalUtils.ts`

- In the per-task computation (lines 163–197), after `laborCost` is finalized for an un-billed task, call `applyLaborDiscount(laborCost, vehicle)` and:
  - Store `discount` on the session detail (new field `laborDiscount`).
  - Subtract it from `laborCost` so totals stay correct downstream.
  - Accumulate `totalDiscount` per vehicle and `grandTotalDiscount`.
- Extend types: `SessionCostDetail.laborDiscount`, `VehicleCostSummary.totalDiscount` + `discountType` + `discountValue`, `ClientCostSummary.grandTotalDiscount`.
- Extend `slimDown` / `inflateSlimPayload` with three new short keys (e.g. `ld`, `td`, `dt`, `dv`, `gtd`) so the wire format carries discount info to the published portal.

### 3. Portal HTML (the embedded `<script>` template in `clientPortalUtils.ts`, ~line 642)

- After the "Vehicle Labor" row, when `v.td > 0`, render:
  `<div class="row" style="color:#22c55e"><span>Discount (X%):</span><span><b>-$X</b></span></div>`
- Add the same row in the grand total block when `s.gtd > 0`, before "Total Parts".

### 4. Portal React view — `src/components/ClientCostBreakdown.tsx`

- Add a green "Discount" row in the per-vehicle subtotal and in the grand-total summary, mirroring the existing Deposit row pattern, shown only when the value is > 0.

### 5. Desktop dashboard task line — `src/pages/DesktopDashboard.tsx`

- Where each task's amount is rendered in the vehicle list (the green `$3,500` in your screenshot), add a small inline `−$X discount` chip next to it (or below the amount) when the vehicle has a discount and the task isn't billed/paid. Purely visual — math is unchanged.

### Out of scope

- Billed/Paid tasks: `task.billedAmount` is the historical lock. We do not retro-apply current discount, matching existing behavior.
- Mobile views: already render discount correctly (TaskCard lines 503, 904, 1678). No change needed.
- Reports/analytics totals: already use `applyLaborDiscount`. No change.

## Goal

Today the per-vehicle discount only applies to un-billed tasks, because once a task is billed its `billedAmount` is treated as a locked, post-everything number. You want the discount to keep working on **Billed** and **Paid** tasks too, and to be visible on all tabs of the portal, on the bill PDF, and on the desktop dashboard.

## Approach

Treat `task.billedAmount` (and `task.importedSalary`) as the **gross labor** for that task — the discount is then re-applied on top, the same way it is for un-billed tasks. Nothing about how the bill is created changes; the discount just stops being skipped when status flips to billed/paid.

## Changes

### 1. `src/pages/DesktopDashboard.tsx`
- `getTaskCost(task)` (~line 794): remove the `if (task.billedAmount != null) return task.billedAmount;` short-circuit. Pass `task.billedAmount` (or `importedSalary`) into `applyLaborDiscount(labor, vehicle)` and add `partsCost` after, just like the un-billed branch.
- `generateBillPdf` (~line 319): remove the `task.billedAmount != null ? { discount: 0 } : applyLaborDiscount(...)` branch — always call `applyLaborDiscount`. Render a "Discount" line on the PDF whenever `discount > 0` (mirrors the un-billed layout).
- `getVehicleDiscount` / `getTaskCostGross` (~lines 821, 857-871): drop the `t.billedAmount == null && t.importedSalary == null` filter so billed/paid labor is included in `unbilledLabor` (rename it `discountableLabor`). Vehicle/client header chips will then show Discount on Billed/Paid views too.

### 2. `src/lib/clientPortalUtils.ts` (`calculateClientCosts`, ~line 189-264)
- Keep the `billedAmount`/`importedSalary` branch that sets `laborCost`, but **remove** the `if (task.billedAmount == null)` guard around `unbilledLabor += laborCost;`. Rename to `discountableLabor` for clarity.
- The single `applyLaborDiscount(discountableLabor, vehicle)` call at the bottom now covers all sessions.

### 3. `src/components/ClientCostBreakdown.tsx` (~line 156-160)
- Remove the `s.status !== 'billed' && s.status !== 'paid'` filter. Sum labor from **all** filtered sessions and apply the per-vehicle discount, so the Discount line and adjusted total show on Billed and Paid tabs too.

### 4. `src/components/TaskCard.tsx` (~line 1398 + `generateBillingPDF` ~line 318)
- Drop the `task.billedAmount != null` short-circuit before `applyLaborDiscount` so the per-task chip and the bill PDF generated from the mobile card both reflect the discount on billed/paid tasks.

### 5. `src/components/DesktopReportsView.tsx` (~line 143-177)
- Same treatment in the reports cost helper: pass billed/imported labor through `applyLaborDiscount` instead of returning it as-is, so analytics labor cost stays consistent with what the client sees.

## Out of scope
- The "lock" of `task.billedAmount` itself stays as the source of truth for the labor amount (so editing periods after billing doesn't change the bill). Only the discount is unlocked, per your request.
- No schema or storage changes. No portal sync changes (slim payload already carries `dt`/`dv` and per-session labor).

## Verification
- Apply a 10% / fixed discount on a vehicle that has at least one Pending, one Billed, and one Paid task.
- Check on **Desktop dashboard** vehicle/client headers, **Bill PDF**, and **Client Portal** Pending / Billed / Paid tabs that the Discount line is shown and the total is reduced consistently.

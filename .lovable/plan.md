

# Full Code Audit: Deposit/Balance Due & Consistency Issues

## Issues Found

### BUG 1: HTML Portal File missing Deposit/Balance Due
**File**: `src/lib/clientPortalUtils.ts` — `generatePortalHtmlFile()` (lines 560-571)
The self-contained HTML portal file (used as fallback when URL is too long) does NOT show deposit or balance due anywhere:
- Vehicle subtotal section (line 560): shows "Vehicle Total" but no deposit/balance
- Grand total section (line 570): shows "GRAND TOTAL" but no deposit/balance
The `pa` field IS included in the data — it's just never rendered in the HTML template.

**Fix**: After the "Vehicle Total" row, add deposit and balance due rows if `v.pa > 0`. Same at the grand total level — sum all `v.pa` and show total deposits + balance due.

### BUG 2: DesktopClientsView PDF missing per-vehicle deposits
**File**: `src/components/DesktopClientsView.tsx` (lines 138-177)
The `generateClientPDF` function does NOT have a per-vehicle section at all — it only has client-level summary with deposits. This is a **simpler PDF** than the one in DesktopDashboard, so no per-vehicle deposit lines are missing because there are no per-vehicle details in this PDF. However, this is inconsistent with the ManageClientsDialog and DesktopDashboard versions which do show per-vehicle breakdowns.

**Decision**: No fix needed — this is an intentionally simpler report. The client-level deposits are already shown.

### CONFIRMED WORKING (No issues):
- **TaskCard mobile cost summary** (line 1546-1551): ✅ Deposit + Balance Due shown
- **TaskCard bill PDF** (lines 486-510): ✅ Subtotal/Deposit/Balance Due
- **TaskCard preview PDF** (lines 858-882): ✅ Subtotal/Deposit/Balance Due  
- **TaskCard share amount** (lines 656-660, 672-677): ✅ Uses balance due
- **ManageClientsDialog PDF** (lines 290-303, 355-364): ✅ Client + per-vehicle deposits
- **DesktopDashboard bill PDF** (lines 391-406): ✅ Deposit/Balance Due
- **DesktopDashboard client report PDF** (lines 862-905): ✅ Both levels
- **DesktopDashboard vehicle header** (lines 1460-1467): ✅ Deposit/Balance Due/Paid
- **ClientCostBreakdown** (lines 393-404, 464-479): ✅ Both levels
- **clientPortalUtils slim encoding** (line 259): ✅ `pa` field included
- **clientPortalUtils inflate** (line 315): ✅ `prepaidAmount` restored
- **EditVehicleDialog** (line 37): ✅ Deposit field present

### CLEANUP: Unused/dead code
- `fetchPortalFromCloud` in `clientPortalUtils.ts` (line 700) is marked `@deprecated` — harmless but could be removed.

## Plan: Fix 1 Issue

### Fix HTML Portal Template — `src/lib/clientPortalUtils.ts`

**Vehicle subtotal** (~line 560): After the "Vehicle Total" row, add:
```javascript
if(v.pa&&v.pa>0){
  h+='<div class="row" style="color:#ef4444"><span>Deposit:</span><span><b>-'+fmt(v.pa)+'</b></span></div>';
  h+='<div class="row total" style="color:#f97316"><span>Balance Due:</span><span>'+fmt(Math.max(0,v.vt-v.pa))+'</span></div>';
}
```

**Grand total** (~line 570): After the "GRAND TOTAL" row, add:
```javascript
var totalDep=0;s.v.forEach(function(v){totalDep+=(v.pa||0)});
if(totalDep>0){
  h+='<div class="row" style="color:#ef4444"><span>Total Deposits:</span><span><b>-'+fmt(totalDep)+'</b></span></div>';
  h+='<div class="row total" style="color:#f97316"><span>BALANCE DUE:</span><span>'+fmt(Math.max(0,s.gt-totalDep))+'</span></div>';
}
```

This is the **only actual bug** — everything else is confirmed working correctly across mobile, desktop, and client portal.


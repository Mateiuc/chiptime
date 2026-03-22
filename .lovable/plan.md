

# Add Deposit/Balance Due to Mobile Views & Client Portal Sync

## Problem
The mobile TaskCard (cost summary, bill PDF, preview PDF), mobile client report (ManageClientsDialog), and the client portal sync are missing the deposit/balance due calculations that were added to the desktop.

## Changes

### 1. Mobile Cost Summary — `src/components/TaskCard.tsx` (~line 1505)
After the "Total:" line, if `vehicle?.prepaidAmount > 0`:
- Add `Deposit:` line in red (destructive) showing negative amount
- Add `Balance Due:` line in bold orange

### 2. Mobile Bill PDF — `src/components/TaskCard.tsx` (~line 485-491)
Before the TOTAL line, if `vehicle?.prepaidAmount > 0`:
- Show current total as "Subtotal:" 
- Add "Deposit:" line with negative amount
- Change final line to "BALANCE DUE:" showing `max(0, totalCost - deposit)`

### 3. Mobile Preview PDF — `src/components/TaskCard.tsx` (~line 837-842)
Same deposit/balance logic as the bill PDF above.

### 4. Mobile Share Bill amount — `src/components/TaskCard.tsx` (~line 640, 655)
Update `totalCost` passed to ShareBillDialog to reflect balance due when deposit exists.

### 5. Mobile Client Report PDF — `src/components/ManageClientsDialog.tsx`
- Per-vehicle section (~line 341-343): after `Total:`, add `Deposit:` and `Balance Due:` lines if vehicle has deposit
- Client summary (~line 290-292): after `Grand Total:`, add total deposits and overall balance due

### 6. Verify Client Portal sync
The `clientPortalUtils.ts` already includes `prepaidAmount` in the wire format (`pa` field), and `ClientCostBreakdown.tsx` already displays deposit/balance. This is confirmed working — no changes needed there.

## Technical Detail
- `vehicle` prop is already available in TaskCard
- Balance calculation: `Math.max(0, totalCost - (vehicle?.prepaidAmount || 0))`
- PDF layout: Subtotal line replaces TOTAL when deposit exists; BALANCE DUE becomes the new final line


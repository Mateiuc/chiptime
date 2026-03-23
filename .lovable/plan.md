

# Full Code Audit — Issues Found

## BUG 1: `importedSalary` ignored in `getClientFinancials` and `getVehicleFinancials`

**Affects**: Client Report PDFs on both Desktop and Mobile (ManageClientsDialog)

Both `getClientFinancials` and `getVehicleFinancials` in `DesktopDashboard.tsx` (lines 759-780, 805-821) and `ManageClientsDialog.tsx` (lines 129-149, 172-187) always calculate labor as `duration × hourlyRate`. They never check `task.importedSalary`.

Meanwhile, `getTaskCost` (line 668) and `calculateClientCosts` in `clientPortalUtils.ts` (line 163) correctly handle it: `if (task.importedSalary != null) { laborCost = task.importedSalary }`.

**Result**: For any imported XLS task, Client Report PDFs show wrong totals (recalculated from time instead of using the imported salary figure).

**Fix**: In all 4 copies of `getClientFinancials`/`getVehicleFinancials`, add an `importedSalary` check per task — if present, use it as laborCost for that task and skip per-session calculation.

---

## BUG 2: Hourly rate falls back to `0` instead of `settings.defaultHourlyRate`

**Affects**: Client Report PDFs, vehicle stats in Desktop and Mobile

In `getClientFinancials` and `getVehicleFinancials`:
- **DesktopDashboard.tsx** lines 752, 798: `client?.hourlyRate || 0`
- **ManageClientsDialog.tsx** lines 121, 164: `client?.hourlyRate || 0`

But `getTaskCost` (line 674) correctly uses `client?.hourlyRate || settings.defaultHourlyRate`.

**Result**: Clients without a custom hourly rate show $0 labor in Client Report PDFs, even though the tree view and bill PDFs show correct amounts.

**Fix**: Change all four occurrences to `client?.hourlyRate || settings.defaultHourlyRate`.

---

## BUG 3: Desktop bill PDF says "TOTAL" instead of "BALANCE DUE" when deposit exists

**Affects**: Desktop bill PDF only (`DesktopDashboard.tsx` line 407)

Mobile bill/preview PDFs correctly show "BALANCE DUE:" as the final label when deposit > 0. The desktop bill PDF shows "Subtotal" and "Deposit" lines correctly, but the final line always reads `TOTAL:` — it should say `BALANCE DUE:` when a deposit exists.

**Fix**: Change line 407 to use `prepaid > 0 ? 'BALANCE DUE:' : 'TOTAL:'`.

---

## CLEANUP: Deprecated dead code

`fetchPortalFromCloud` in `clientPortalUtils.ts` (line 705-719) is marked `@deprecated` and unused. Safe to remove.

---

## CONFIRMED WORKING (No issues):
- Mobile cost summary UI (TaskCard): Deposit + Balance Due ✅
- Mobile bill PDF: Subtotal/Deposit/Balance Due ✅
- Mobile preview PDF: Subtotal/Deposit/Balance Due ✅
- Mobile share amount: Uses balance due ✅
- Desktop vehicle header: Deposit/Balance Due/Paid ✅
- Desktop client report PDF: Deposits at client + vehicle level ✅
- Mobile client report PDF (ManageClientsDialog): Deposits at client + vehicle level ✅
- Client portal (ClientCostBreakdown React): Deposit/Balance Due at both levels ✅
- Client portal HTML fallback: Deposit/Balance Due at both levels ✅
- Portal sync (`clientPortalUtils`): `prepaidAmount` encoded/decoded correctly ✅
- Cloud sync (`appSyncService`): Working correctly ✅
- `calculateClientCosts`: Handles `importedSalary` correctly ✅
- `getTaskCost`: Handles `importedSalary` and default rates correctly ✅
- All rate types (Add Key, All Keys Lost) propagated everywhere ✅

## Plan Summary

| # | What | Where | Severity |
|---|------|-------|----------|
| 1 | Add `importedSalary` check to financials helpers | DesktopDashboard + ManageClientsDialog (4 functions) | High — wrong PDF totals |
| 2 | Fix hourly rate fallback to `settings.defaultHourlyRate` | Same 4 functions | High — $0 labor for some clients |
| 3 | "TOTAL" → "BALANCE DUE" label on desktop bill PDF | DesktopDashboard line 407 | Low — cosmetic inconsistency |
| 4 | Remove deprecated `fetchPortalFromCloud` | clientPortalUtils.ts | Cleanup |


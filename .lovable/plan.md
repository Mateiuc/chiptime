

# Fix: Use `importedSalary` in DesktopDashboard Cost Calculations

The previous fix only updated `TaskCard.tsx` and `clientPortalUtils.ts`, but `DesktopDashboard.tsx` has its own independent cost calculations that still use `hourlyRate × duration`. Two locations need fixing:

## Changes in `src/pages/DesktopDashboard.tsx`

### 1. `getTaskCost()` helper (line ~393)
Add an early return: if `task.importedSalary != null`, return `task.importedSalary + partsCost` instead of calculating from hourly rate.

### 2. `generateBillPdf()` (line ~220)
After computing `laborCost` on line 233, override it: if `task.importedSalary != null`, set `laborCost = task.importedSalary` so the PDF invoice shows the correct imported amount.

Both are small, surgical changes — just add `importedSalary` checks before the existing calculated values.


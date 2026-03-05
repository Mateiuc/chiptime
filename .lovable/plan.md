

# Use `importedSalary` as the Displayed Cost for Imported Tasks

## Problem
The `importedSalary` value is correctly parsed and stored on the task, but every cost display still calculates `hourlyRate × duration`. The "rel. Salary" amount is never shown.

## Solution
When a task has `importedSalary` set, use that as the total cost instead of computing from hourly rate. This affects three locations:

### 1. `src/components/TaskCard.tsx` (lines ~1111-1127)
- After the existing labor cost calculation, check if `task.importedSalary` is defined
- If so, override `laborCost` and `totalCost` with `task.importedSalary` (no parts cost addition since imported tasks don't have parts)
- Also update the PDF generators (~line 387 and ~701) to use `importedSalary` when available

### 2. `src/lib/clientPortalUtils.ts` (lines ~122-144)
- In the session cost calculation, if the parent task has `importedSalary`, use that as `laborCost` instead of `(duration / 3600) * hourlyRate`
- Since imported tasks have exactly one session, assign the full `importedSalary` to that session's `laborCost`

### 3. `src/components/ClientCostBreakdown.tsx`
- No changes needed — it already reads `laborCost` from the session summary objects produced by `clientPortalUtils`

### Files to edit
- `src/components/TaskCard.tsx` — use `importedSalary` for display and PDFs
- `src/lib/clientPortalUtils.ts` — pass `importedSalary` through to session cost


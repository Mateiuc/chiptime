

# Fix: "Cannot access before initialization" crash on Desktop Dashboard

## Problem
The `monthlyRevenueData` `useMemo` hook was added near line 112, but it calls `getTaskCost()` which is defined at line 408. Since `const` declarations are not hoisted, this causes a runtime error: "Cannot access 'St' before initialization."

## Solution
Move the `monthlyRevenueData` `useMemo` block (and the `chartClient` state) to **after** the `getTaskCost` function definition (after line ~420). This ensures `getTaskCost` is already declared when the memo runs.

### File to edit
- `src/pages/DesktopDashboard.tsx` — relocate `chartClient` state and `monthlyRevenueData` memo from lines ~112-128 to after line ~420


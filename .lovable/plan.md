

# Add Separate Line Items for Min 1hr / Cloning / Programming Charges

## Problem
Currently, cloning, programming, and min-1hr charges are silently folded into "Labor Cost". The user wants to see them as **separate line items** in all billing displays and PDFs so the breakdown is transparent.

## Approach
Track cloning total, programming total, and min-1hr adjustment separately in all financial calculation functions, then display them as distinct rows wherever costs are shown.

## Changes

### 1. Refactor financial calculation helpers
In every file that computes costs (`TaskCard.tsx`, `DesktopDashboard.tsx`, `DesktopClientsView.tsx`, `ManageClientsDialog.tsx`, `clientPortalUtils.ts`), split the aggregation to track 4 values:
- **Base labor** (time × hourly rate, using actual duration)
- **Min 1hr adjustment** (extra charge when session < 1hr and flag is on)
- **Cloning total** (sum of cloning rate for flagged sessions)
- **Programming total** (sum of programming rate for flagged sessions)

### 2. TaskCard UI — collapsible details (lines ~1253-1297)
Add flags/badges per session showing which billing options are active (e.g., small badges: "Min 1hr", "Cloning", "Programming"). Add a cost summary section at the bottom of the expanded details showing the breakdown lines.

### 3. TaskCard PDFs (3 PDF generators)
After the "Labor" line, add conditional lines:
```
Labor (2h30m @ $85/hr):           $212.50
Min 1 Hour adjustment (×2):       $xx.xx    ← only if any session used it
Cloning (×1):                      $xx.xx    ← only if any session used it
Programming (×3):                  $xx.xx    ← only if any session used it
Parts:                             $xx.xx
─────────────────────────────────
Total:                             $xxx.xx
```

### 4. DesktopDashboard PDF (line ~237)
Same pattern — add cloning/programming lines after the labor line.

### 5. ManageClientsDialog — client/vehicle financials display + PDF
Add `totalCloning`, `totalProgramming`, `totalMinHourAdj` to return objects. Show as separate lines in the PDF and any UI summaries.

### 6. ClientCostBreakdown — session display (line ~185-188)
Show "Labor: $X" then conditional tags/lines for cloning and programming charges on that session. Update vehicle subtotals and grand total to show separate lines.

### 7. clientPortalUtils / Portal HTML
Add cloning/programming as separate fields in the slim format and render them as distinct lines in the self-contained HTML portal.

### Files to edit
- `src/components/TaskCard.tsx` — 3 PDF generators + UI cost display + session details
- `src/pages/DesktopDashboard.tsx` — PDF generator + task cost calculation
- `src/components/DesktopClientsView.tsx` — financial calculations
- `src/components/ManageClientsDialog.tsx` — financial calculations + PDF
- `src/components/ClientCostBreakdown.tsx` — session/vehicle/grand total display
- `src/lib/clientPortalUtils.ts` — slim format + portal HTML


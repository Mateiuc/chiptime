## Merge Vehicle + Time into one Card

In `src/components/DesktopReportsView.tsx`, combine the two separate purple cards ("Revenue by Vehicle (Top 20)" and "Time worked per day") into a single `<Card lg:col-span-2>` that holds both charts side-by-side in an internal 2-column grid.

### Changes

1. Delete the two standalone purple `<Card>` wrappers.
2. Replace with one card:
   - `<Card className="border-2 border-purple-500/30 lg:col-span-2">`
   - Inside `<CardContent>`, render a `grid grid-cols-1 lg:grid-cols-2 gap-6` with two columns:
     - **Left:** title "Revenue by Vehicle (Top 20)" + the existing vertical bar chart in `h-[380px]`, followed by `drillVehicle` DrillTable.
     - **Right:** title "Time worked per day — {filter label}" + the existing stacked bar chart in `h-[380px]`.
   - Each side gets its own small `<div>` title block (same `text-sm font-medium text-purple-700 dark:text-purple-400`) so they read as paired headers inside one card.
3. Keep all chart logic, colors, tooltips, and click handlers unchanged.

### Out of scope
- No data/color/tooltip logic changes.
- No changes to Revenue Over Time or Revenue by Client cards.

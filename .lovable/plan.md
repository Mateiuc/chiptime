

# Add Sorting, Date Filter, and Status Toggles to Drill-Down Table

## Changes in `src/pages/DesktopDashboard.tsx`

### 1. New state variables
- `drillSortField`: `'date' | 'cost'` (default `'date'`)
- `drillSortDir`: `'asc' | 'desc'` (default `'desc'`)
- `drillShowCompleted`, `drillShowBilled`, `drillShowPaid`: booleans, all default `true`

### 2. Update `drillDownData` memo
- Include task status in each row object (`status: t.status`)
- Include raw date for sorting (`rawDate: new Date(t.createdAt).getTime()`)
- Filter by status toggles: only include tasks whose status matches enabled flags (completed/billed/paid)
- Sort by `drillSortField` + `drillSortDir` instead of hardcoded cost descending

### 3. Add controls row above the table (inside the drillMonth block)
A small toolbar between the header ("Details for...") and the table:
- **Sort by**: Two small clickable header labels on Date and Cost columns with up/down arrow icons (ArrowUpDown from lucide). Clicking toggles sort direction, clicking different column switches sort field.
- **Status toggles**: Three small toggle buttons/badges: "Completed", "Billed", "Paid" — each toggleable on/off with visual feedback (filled vs outline). Uses the existing Badge or small buttons.

### 4. Make table headers clickable for sort
The Date and Cost `<th>` elements become clickable with an arrow indicator showing current sort direction.

### 5. Reset drill filters when drillMonth changes
When `setDrillMonth` is called, reset sort and status filters to defaults.


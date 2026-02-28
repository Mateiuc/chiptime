

# Edit Task Dialog Desktop Improvements

## 1. Task info in header
Replace generic "Edit Task" title with rich context:
- Client name, vehicle make/model/year, VIN (truncated), and status badge
- Use existing `task` props: `task.customerName`, `task.carVin`, `task.status`
- Pass `client` and `vehicle` objects as optional props (or derive from existing data)
- Header layout: `"Edit Task — ClientName · 2024 BMW X5 · VIN: 1HGCM..."`  with a colored status badge

## 2. Collapsible sessions
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from radix
- Add state: `expandedSessions: Set<string>` — default all expanded
- Session header becomes the trigger with a chevron icon that rotates
- Show inline summary when collapsed: "Session 1 · Jan 9 · 1h 12m · 2 parts · $45.00"
- Content (periods, parts, description) wrapped in `CollapsibleContent`

## Changes — `src/components/EditTaskDialog.tsx`

### Props update
- Add optional `clientName?: string` and `vehicleInfo?: string` props (fallback to `task.customerName` and `task.carVin`)

### Desktop header (lines 689-694)
- Replace `"Edit Task"` with formatted string including client, vehicle, status
- Add status badge with color mapping

### Desktop session cards (lines 698-842)
- Wrap each session body (lines 715-839) in `Collapsible`
- Session header row becomes `CollapsibleTrigger` with chevron + collapsed summary
- Add `expandedSessions` state, toggle on click
- When collapsed, show one-line summary: session time total, parts count, parts cost

### Files changed
- `src/components/EditTaskDialog.tsx`
- Minor: callers in `DesktopDashboard.tsx` may pass extra props (optional, falls back gracefully)


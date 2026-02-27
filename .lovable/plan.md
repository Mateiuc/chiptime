

# Desktop: Table View with Photos (Keep Client Sidebar)

Replace the card grid in the main content area with a table layout, including photo thumbnails.

## Changes — `src/pages/DesktopDashboard.tsx`

### Replace `renderTaskGroup` with table rendering

- Import `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from UI
- Import `Badge` for status, photo loading utilities from `photoStorageService`

### Table columns

| Client (when "All") | Vehicle | VIN | Photos | Status | Time | Cost | Actions |
|---|---|---|---|---|---|---|---|

- **Photos column**: Show small thumbnails (32×32px) of session photos. Collect all `SessionPhoto` entries from `task.sessions`, load their URLs via `photoStorageService.getPhotoUrl()` on mount (or use `cloudUrl` if available). Show up to 3 thumbnails with a "+N" badge if more exist. Clicking opens a lightbox or the edit dialog.
- **Vehicle**: Year Make Model
- **VIN**: Truncated to 8 chars
- **Status**: Colored badge
- **Time**: Formatted HH:MM:SS
- **Cost**: (totalTime/3600) × hourlyRate + sum of parts prices
- **Actions**: Contextual buttons (Edit, Bill, Paid, Reactivate, Delete)

### Photo loading

- Add a `useEffect` that iterates all visible tasks, collects photo references from sessions, and resolves their display URLs (prefer `cloudUrl`, fallback to `photoStorageService.getPhotoUrl(filePath)`)
- Store in a `Record<string, string[]>` keyed by task ID
- Photos load asynchronously; show skeleton placeholders while loading

### Row interaction

- Clicking "Edit" or the row opens `EditTaskDialog` (existing component) for full detail editing
- Add `editingTask` state to manage which task's dialog is open

### Files changed
- `src/pages/DesktopDashboard.tsx` — replace card grid with table, add photo thumbnails, add edit dialog state


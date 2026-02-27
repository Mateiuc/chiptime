

# Desktop Table: Remove Status, Add Expandable Details with Photos

## Problem
- Status column is redundant (tabs already separate by status)
- No way to see work details (sessions, parts, descriptions) without opening the edit dialog
- Photos taken on phone aren't visible on desktop (photos are stored locally on phone; only `cloudUrl` works on desktop)

## Changes — `src/pages/DesktopDashboard.tsx`

### 1. Remove Status column
- Remove the Status `<TableHead>` and `<TableCell>` with the Badge from `renderTaskTable`

### 2. Add expandable row details
- Import `ChevronDown` from lucide and `Collapsible, CollapsibleTrigger, CollapsibleContent` from UI
- Add state `expandedTaskIds: Set<string>` to track which rows are expanded
- Add an expand/collapse chevron button as the first cell in each row
- When expanded, render a full-width detail row below with:
  - **Sessions list**: Each session with its description, date, duration (sum of periods), and parts
  - **Parts per session**: Name, quantity, price in a small sub-table
  - **Photos**: Show all `cloudUrl` photos from each session (not local filePath — desktop can't access phone filesystem). Display as a grid of thumbnails (64×64px). If no `cloudUrl`, show placeholder text "Photo on device only"
  - **Work periods**: Start/end times for each period within a session

### 3. Fix photo display for desktop
- In the photo thumbnail column and expanded details, only use `photo.cloudUrl` (skip `photoStorageService.loadPhoto` which only works on the device that took the photo)
- Update the `useEffect` photo loader to only collect `cloudUrl` entries
- In expanded details, show all photos (not just 3) using `cloudUrl`

### Files changed
- `src/pages/DesktopDashboard.tsx` — remove status column, add expandable detail rows, fix photo source to cloudUrl only


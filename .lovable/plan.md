

# Fix XLS Import — One Task Per Row

## Current Behavior
All rows sharing the same tag are grouped into a single task with multiple work sessions. This merges unrelated work together.

## Desired Behavior
Each row in the XLS creates:
- A **vehicle** (reused if same tag already exists for that client)
- Its own **task** with a single work session containing the parsed periods

So 133 rows → 133 tasks. Vehicles are still deduplicated by tag (e.g., all "X5" rows share one vehicle, but each gets its own task).

## Changes — `src/pages/DesktopDashboard.tsx` (lines 125–183)

Replace the "group by tag" logic with a per-row loop:

1. Remove the `byTag` Map grouping
2. For each imported session:
   - Find or create a vehicle for the tag (same dedup logic as now)
   - Create one Task with one WorkSession containing the row's periods
   - `totalTime` = that row's `relDurationSeconds`
   - Status = `completed`
3. Toast shows total tasks created

### Files to edit
- `src/pages/DesktopDashboard.tsx` — replace grouping logic with per-row task creation


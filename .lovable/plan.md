

# Changes to Desktop Dashboard

## 1. Remove "Reactivate" button from tasks
- Delete lines 453-457 (the `RotateCcw` button that appears on completed/billed/paid tasks)
- Remove `RotateCcw` from imports and remove `handleRestartTimer` if no longer used

## 2. Add "Expected Gain" summary for Completed filter
At the bottom of the tree (after the client cards), when `filter === 'completed'`, show a summary section:
- A colorful card listing each client that has completed tasks, with their expected gain (sum of `getTaskCost` for their completed tasks)
- A total row at the bottom summing all clients
- Simple table/list format — not a chart — with client name, number of completed tasks, and expected revenue
- Styled with a gradient background similar to the revenue charts section

## Files changed
- `src/pages/DesktopDashboard.tsx` — remove reactivate button, add completed gain summary




# Round Seconds in All Duration Displays

## Problem
Duration displays throughout the app show raw seconds (HH:MM:SS format). The user wants seconds rounded to the nearest minute everywhere.

## Changes

### 1. Update `src/lib/formatTime.ts` — `formatDuration` function
Change from `HH:MM:SS` to `HH:MM` format with seconds rounded to the nearest minute:
- If seconds >= 30, round minutes up
- If seconds < 30, round minutes down
- Keep the `HH:MM` format (no seconds shown)

### 2. Update local `formatDuration` variants
Several components define their own inline `formatDuration` — these already show `Xh Xm` without seconds but don't round. Add rounding:

- **`src/components/DesktopClientsView.tsx`** (line 72): Local `formatDuration` — add rounding of remaining seconds
- **`src/components/ManageClientsDialog.tsx`** (line 111-114): Local `formatDuration` — add rounding

### 3. Update `formatDurationHHMM` in TaskCard PDF generation
- **`src/components/TaskCard.tsx`** (lines 376-380 and 738-742): Two duplicate `formatDurationHHMM` functions used for PDF bills — add second-rounding to minutes

### 4. Files affected (no changes needed)
These files import `formatDuration` from `formatTime.ts` and will automatically get the fix:
- `TaskCard.tsx` (card display)
- `TaskInlineEditor.tsx` (inline editor)
- `DesktopReportsView.tsx` (reports table)
- `EditTaskDialog.tsx` (edit dialog)

## Technical Detail
Rounding logic applied everywhere:
```typescript
const totalMinutes = Math.round(seconds / 60);
const hours = Math.floor(totalMinutes / 60);
const minutes = totalMinutes % 60;
```


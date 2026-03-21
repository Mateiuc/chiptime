
# Move Diagnostic PDF to Task Level + Add Upload Indicator

## Completed

### Changes Made
1. **`src/types/index.ts`** — Added `diagnosticPdfUrl?: string` to `Task` interface
2. **`src/pages/DesktopDashboard.tsx`** — Removed FileUp button from vehicle header, added it to each task row with green indicator when PDF attached, updated upload handler and bill merge to use `task.diagnosticPdfUrl`
3. **`src/components/TaskCard.tsx`** — Updated upload handler to save on task via `onUpdateTask`, updated bill and preview PDF merge to use `task.diagnosticPdfUrl`, added "Diagnostic PDF" badge on card when attached
4. **`supabase/functions/upload-diagnostic/index.ts`** — Now accepts `taskId` in addition to `vehicleId` for storage path

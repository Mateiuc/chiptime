

# Move Diagnostic PDF to Task Level + Add Upload Indicator

## Summary
Move diagnostic PDF from vehicle-level to task-level. Move upload button to each task's action area on both mobile and desktop. Show visual indicator when a diagnostic file is uploaded. Ensure bill preview and final bill both merge the diagnostic PDF.

## Changes

### 1. `src/types/index.ts` — Add `diagnosticPdfUrl` to Task
- Add `diagnosticPdfUrl?: string` to the `Task` interface
- Keep vehicle-level field for backward compatibility but stop using it in bill generation

### 2. `src/pages/DesktopDashboard.tsx`
- **Remove** the `FileUp` button from the vehicle header row (line 1251-1253)
- **Add** an upload diagnostic button to each task's action buttons (lines 1324-1361), next to Bill/Delete
- **Update** `handleUploadDiagnosticPdf` to accept `taskId` instead of `vehicleId`, save URL to task via `updateTask(taskId, { diagnosticPdfUrl: url })`
- **Update** `generateBillPdf` (line 480): use `task.diagnosticPdfUrl` instead of `vehicle.diagnosticPdfUrl`
- **Add** a visual indicator (green icon or badge) on the task row when `task.diagnosticPdfUrl` exists, showing that a diagnostic file is attached

### 3. `src/components/TaskCard.tsx`
- **Update** upload handler to save `diagnosticPdfUrl` on the task (`onUpdateTask`) instead of vehicle (`onUpdateVehicle`)
- **Update** bill generation merge (line 615): use `task.diagnosticPdfUrl` instead of `vehicle?.diagnosticPdfUrl`
- **Add** a small visual indicator (badge/icon) when `task.diagnosticPdfUrl` is set, so user knows a file is attached
- Keep the dropdown menu item but update its label/logic for task-level

### 4. `supabase/functions/upload-diagnostic/index.ts`
- Accept `taskId` in addition to `vehicleId` for the storage path; use `taskId` when provided, fall back to `vehicleId`

## Files to edit
1. `src/types/index.ts`
2. `src/pages/DesktopDashboard.tsx`
3. `src/components/TaskCard.tsx`
4. `supabase/functions/upload-diagnostic/index.ts`


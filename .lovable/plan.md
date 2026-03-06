

# Add "Paid" Column Support to XLS Import

The uploaded XLS file has a "Paid" column with "Yes"/"No" values. Currently the importer ignores this column and sets all imported tasks to `status: 'completed'`. This change will read that column and set the task status to `'paid'` when "Yes", keeping `'completed'` when "No".

## Changes

### 1. `src/lib/xlsImporter.ts`
- Add `paid: boolean` field to the `ImportedSession` interface
- Detect the "paid" column index using the existing `col()` helper
- Parse the value: treat "yes"/"true"/"1" (case-insensitive) as `true`, everything else as `false`
- Include it in each returned session object

### 2. `src/pages/DesktopDashboard.tsx`
- In `handleImportXls`, when building each `Task`, set `status: s.paid ? 'paid' : 'completed'` instead of the hardcoded `'completed'`

Two small edits, no UI changes needed -- the existing status filters on the chart and drill-down will automatically show/hide the paid vs completed imported tasks.


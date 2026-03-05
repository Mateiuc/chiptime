

# Add "rel. Salary" Support to XLS Import

## What's new in the file
The file now has a **"rel. Salary"** column (column 5) between "rel. Duration" and "Description". This shifts Description to column 6, Tags to 7, Breaks to 8, Breaks Description to 9.

Example: row 1 has `rel. Salary = 358.40` for "G20 m340i headlight..." work.

## Plan

### 1. Add `relSalary` to `ImportedSession` interface
Add `relSalary?: number` to the interface in `src/lib/xlsImporter.ts`.

### 2. Parse the new column in `parseWorkHistoryXls`
- Header mode: detect column by name `"rel. salary"` or `"salary"`
- Headerless fallback: column index 5 (shift `descCol` to 6, `tagsCol` to 7, `breaksDescCol` to 9)
- Parse the value as a number (handle both raw number and string like `"358.40"`)

### 3. Add `importedSalary` to `Task` type
Add optional `importedSalary?: number` field to the `Task` interface in `src/types/index.ts`. This preserves the exact dollar amount from the XLS without interfering with the existing billing calculation.

### 4. Store salary during import
In `src/pages/DesktopDashboard.tsx`, pass `s.relSalary` into the task object as `importedSalary`.

### Files to edit
- `src/lib/xlsImporter.ts` — parse new column, update interface
- `src/types/index.ts` — add `importedSalary` to Task
- `src/pages/DesktopDashboard.tsx` — store salary on task creation


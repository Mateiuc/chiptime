

# Revamp XLS Importer for New File Format

## Understanding the File

The uploaded XLS has columns: **Date | Start time | End time | Duration | rel. Duration | Description | Tags | Breaks | Breaks Description**

- **Tags** = car model identifier (e.g., "Porsche Panamera", "X5", "650"). Can be blank or contain multiple comma-separated tags (e.g., "1 Series , 5 Series").
- **Description** = work done in that session
- **rel. Duration** = actual working time (excludes breaks) — this is the authoritative duration
- **Breaks Description** = break intervals like `"15:21 – 18:01"` or `"14:42 – 16:39"`, comma/newline separated for multiple breaks

## Import Logic

For each row:
1. Parse Tags → one vehicle per unique tag string. Blank tags get a placeholder vehicle.
2. Each row becomes one **session** on that vehicle's task.
3. **Work periods** are derived from Start time, End time, and Breaks Description:
   - Work: `startTime → break1Start`
   - Break: `break1Start → break1End` (skipped, not a period)
   - Work: `break1End → break2Start`
   - ... and so on
   - Work: `lastBreakEnd → endTime`
4. If no breaks, single period: `startTime → endTime`
5. Each period's duration is calculated. Total working time validated against `rel. Duration`.
6. Rows sharing the same Tag are grouped into the **same task** (one task per vehicle), each row as a separate session.

For rows with multiple tags (e.g., "Benz C300, X5"), create a session on each vehicle's task (the work description applies to both).

## Changes

### 1. Rewrite `src/lib/xlsImporter.ts`

New exported interface and function:

```typescript
export interface ImportedSession {
  tag: string;              // vehicle/car model from Tags column
  date: Date;
  startTime: Date;
  endTime: Date;
  description: string;
  relDurationSeconds: number; // actual working time
  periods: { startTime: Date; endTime: Date; duration: number }[];
}

export const parseWorkHistoryXls = async (file: File): Promise<ImportedSession[]>
```

- Read columns by header name (not index) for robustness
- Parse Breaks Description: split on `,` or `<br/>`, each segment is `"HH:MM – HH:MM"` or full date format like `"March 1, 2024, 19:49 – March 2, 2024, 03:18"`
- Build periods by sorting breaks chronologically and slicing work time around them
- Use `rel. Duration` as the authoritative total working time for calibration

### 2. Update `src/pages/DesktopDashboard.tsx` — `handleImportXls`

- Call new parser → get `ImportedSession[]`
- Group sessions by `tag`
- For each unique tag:
  - Create a Vehicle with `make = tag`, `vin = "IMPORT-" + tag` (or placeholder if blank)
  - Create one Task (status: completed) containing all sessions for that tag
  - Each session has properly constructed `WorkPeriod[]` from the parsed periods
  - `totalTime` = sum of all session `relDurationSeconds`

### Files to edit
- `src/lib/xlsImporter.ts` — full rewrite of parser
- `src/pages/DesktopDashboard.tsx` — update `handleImportXls` to use new grouped format


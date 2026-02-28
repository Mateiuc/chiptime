

# Import XLS Work History per Client — Desktop Only

## What the file contains
The XLS has rows with: **Date | Start time | End time | Description**. Each row represents a work period. These need to be imported as tasks with sessions/periods for the selected client.

## Approach

### Import logic
- Each row becomes **one task** with **one session** containing **one work period** (start→end from the file)
- The description column becomes the session description
- A placeholder vehicle is created (or reused) called "Imported — Edit Later" since vehicle info isn't in the file
- Tasks are created with status `completed` and `totalTime` calculated from start/end

### Parse XLS
- Use the browser's `FileReader` to read the uploaded `.xls` file
- Since we don't have an XLS parsing library, we'll add **`xlsx`** (SheetJS) package to parse `.xls/.xlsx` files
- Extract rows as `[Date, Start time, End time, Description]`

### UI — `src/pages/DesktopDashboard.tsx`
- Add an **Upload** button (file icon) in the client header row, next to the existing Edit/Add Vehicle/Delete buttons (~line 491)
- Hidden `<input type="file" accept=".xls,.xlsx">` triggered by the button
- On file select: parse with SheetJS, create a placeholder vehicle for the client, batch-create tasks

### New utility — `src/lib/xlsImporter.ts`
- `parseWorkHistoryXls(file: File)` → returns array of `{ date: string, startTime: string, endTime: string, description: string }`
- Handles date/time parsing (combines Date + Start time → JS Date, Date + End time → JS Date)
- Calculates duration in seconds

### Files changed
- **Install**: `xlsx` package (SheetJS)
- **New**: `src/lib/xlsImporter.ts` — XLS parsing utility
- **Edit**: `src/pages/DesktopDashboard.tsx` — add import button + handler that creates vehicle + tasks


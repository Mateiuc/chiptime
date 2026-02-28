import * as XLSX from 'xlsx';

export interface ImportedWorkRow {
  date: Date;
  startTime: Date;
  endTime: Date;
  description: string;
  durationSeconds: number;
}

/**
 * Parse an XLS/XLSX file with columns: Date | Start time | End time | Description
 * Returns structured rows ready to be turned into tasks.
 */
export const parseWorkHistoryXls = async (file: File): Promise<ImportedWorkRow[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header row
  const rows = raw.slice(1).filter(r => r && r.length >= 3);

  const results: ImportedWorkRow[] = [];

  for (const row of rows) {
    try {
      const dateRaw = row[0];
      const startRaw = row[1];
      const endRaw = row[2];
      const description = (row[3] ?? '').toString().trim();

      const baseDate = parseExcelDate(dateRaw);
      if (!baseDate) continue;

      const startTime = combineDateTime(baseDate, startRaw);
      const endTime = combineDateTime(baseDate, endRaw);
      if (!startTime || !endTime) continue;

      // If end time is before start time, it crossed midnight — add a day
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      results.push({ date: baseDate, startTime, endTime, description, durationSeconds });
    } catch {
      // Skip unparseable rows
    }
  }

  return results;
};

function parseExcelDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function combineDateTime(baseDate: Date, timeVal: any): Date | null {
  if (timeVal == null) return null;

  const result = new Date(baseDate);

  // Excel stores times as fractional days (0.5 = noon)
  if (typeof timeVal === 'number') {
    const totalMinutes = Math.round(timeVal * 24 * 60);
    result.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return result;
  }

  if (typeof timeVal === 'string') {
    // Parse "12:36 PM" or "14:25" style
    const match = timeVal.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  if (timeVal instanceof Date) {
    result.setHours(timeVal.getHours(), timeVal.getMinutes(), 0, 0);
    return result;
  }

  return null;
}

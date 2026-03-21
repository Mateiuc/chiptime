import ExcelJS from '@zurmokeeper/exceljs';

export interface ImportedSession {
  tag: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  description: string;
  relDurationSeconds: number;
  relSalary?: number;
  paid: boolean;
  periods: { startTime: Date; endTime: Date; duration: number }[];
}

/**
 * Parse an XLS/XLSX file with columns:
 * Date | Start time | End time | Duration | rel. Duration | Description | Tags | Breaks | Breaks Description
 */
export const parseWorkHistoryXls = async (file: File): Promise<ImportedSession[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return [];

  // Collect all rows as arrays
  const raw: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (values.length < colNumber - 1) values.push(null);
      values.push(cell.value);
    });
    raw.push(values);
  });

  if (raw.length === 0) return [];

  // Find column indices by header name
  const headers = raw[0].map((h: any) => (h ?? '').toString().trim().toLowerCase());
  const col = (name: string) => {
    const idx = headers.findIndex(h => h.includes(name));
    return idx;
  };

  let dateCol = col('date');
  let startCol = col('start');
  let endCol = col('end time') !== -1 ? col('end time') : col('end');
  let relDurCol = col('rel.');
  let descCol = col('description');
  let tagsCol = col('tags');
  let relSalaryCol = col('salary');
  let breaksDescCol = col('breaks desc');
  let paidCol = col('paid');

  // Headerless fallback: assume standard column order
  let dataStart = 1;
  if (dateCol === -1 || startCol === -1 || endCol === -1) {
    dateCol = 0; startCol = 1; endCol = 2; relDurCol = 4;
    relSalaryCol = 5; descCol = 6; tagsCol = 7; breaksDescCol = 9;
    dataStart = 0;
  }

  const results: ImportedSession[] = [];

  for (let i = dataStart; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 3) continue;

    try {
      const baseDate = parseExcelDate(row[dateCol]);
      if (!baseDate) continue;

      const startTime = combineDateTime(baseDate, row[startCol]);
      const endTime = combineDateTime(baseDate, row[endCol]);
      if (!startTime || !endTime) continue;

      // Handle midnight crossing
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      let description = '';
      if (descCol !== -1 && row[descCol] != null) {
        const rawDesc = row[descCol];
        if (typeof rawDesc === 'number' && rawDesc >= 0 && rawDesc <= 1) {
          description = '';
        } else {
          description = rawDesc.toString().trim();
        }
      }
      const tagsRaw = tagsCol !== -1 ? (row[tagsCol] ?? '').toString().trim() : '';
      const breaksDescRaw = breaksDescCol !== -1 ? (row[breaksDescCol] ?? '').toString().trim() : '';

      const relDurationSeconds = relDurCol !== -1 ? parseDurationToSeconds(row[relDurCol]) : null;

      let relSalary: number | undefined;
      if (relSalaryCol !== -1 && row[relSalaryCol] != null) {
        const salaryVal = row[relSalaryCol];
        const parsed = typeof salaryVal === 'number' ? salaryVal : parseFloat(String(salaryVal).replace(/[^0-9.\-]/g, ''));
        if (!isNaN(parsed)) relSalary = parsed;
      }

      const breaks = parseBreaksDescription(breaksDescRaw, baseDate);
      const periods = buildPeriods(startTime, endTime, breaks);
      const totalWorkSeconds = relDurationSeconds ?? periods.reduce((sum, p) => sum + p.duration, 0);

      const tags = tagsRaw
        ? tagsRaw.split(/,/).map(t => t.trim()).filter(Boolean)
        : [''];

      const paidRaw = paidCol !== -1 && row[paidCol] != null ? String(row[paidCol]).toLowerCase().trim() : '';
      const paid = ['yes', 'true', '1'].includes(paidRaw);

      for (const tag of tags) {
        results.push({
          tag,
          date: baseDate,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          description,
          relDurationSeconds: totalWorkSeconds,
          relSalary,
          paid,
          periods: periods.map(p => ({ ...p })),
        });
      }
    } catch {
      // Skip unparseable rows
    }
  }

  return results;
};

function parseExcelDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date number: convert manually
    // Excel epoch is Jan 0 1900 (day 1 = Jan 1 1900), with the Lotus 1-2-3 bug (day 60 = Feb 29 1900)
    const epoch = new Date(1899, 11, 30); // Dec 30 1899
    const d = new Date(epoch.getTime() + val * 86400000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

  // ExcelJS may return Date objects for time cells
  if (timeVal instanceof Date) {
    result.setHours(timeVal.getHours(), timeVal.getMinutes(), 0, 0);
    return result;
  }

  if (typeof timeVal === 'number') {
    const totalMinutes = Math.round(timeVal * 24 * 60);
    result.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return result;
  }

  if (typeof timeVal === 'string') {
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

  return null;
}

function parseDurationToSeconds(val: any): number | null {
  if (val == null) return null;

  if (val instanceof Date) {
    return val.getHours() * 3600 + val.getMinutes() * 60 + val.getSeconds();
  }

  if (typeof val === 'number') {
    return Math.round(val * 24 * 3600);
  }

  if (typeof val === 'string') {
    const match = val.match(/(\d+):(\d{2}):(\d{2})/);
    if (match) {
      return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    }
    const matchShort = val.match(/(\d+):(\d{2})/);
    if (matchShort) {
      return parseInt(matchShort[1]) * 3600 + parseInt(matchShort[2]) * 60;
    }
  }

  return null;
}

interface BreakInterval {
  start: Date;
  end: Date;
}

function parseBreaksDescription(raw: string, baseDate: Date): BreakInterval[] {
  if (!raw) return [];

  const segments = raw.split(/<br\s*\/?>|\n/).map(s => s.replace(/^[,\s]+|[,\s]+$/g, '')).filter(Boolean);
  const breaks: BreakInterval[] = [];

  for (const seg of segments) {
    const fullDateMatch = seg.match(/(.+?)\s*[–-]\s*(.+)/);
    if (!fullDateMatch) continue;

    const startStr = fullDateMatch[1].trim();
    const endStr = fullDateMatch[2].trim();

    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;

    const startFull = new Date(startStr);
    const endFull = new Date(endStr);

    if (!isNaN(startFull.getTime()) && !isNaN(endFull.getTime()) && startStr.length > 6) {
      breakStart = startFull;
      breakEnd = endFull;
    } else {
      breakStart = parseTimeOnly(startStr, baseDate);
      breakEnd = parseTimeOnly(endStr, baseDate);
    }

    if (breakStart && breakEnd) {
      if (breakEnd <= breakStart) {
        breakEnd.setDate(breakEnd.getDate() + 1);
      }
      breaks.push({ start: breakStart, end: breakEnd });
    }
  }

  breaks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return breaks;
}

function parseTimeOnly(str: string, baseDate: Date): Date | null {
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const result = new Date(baseDate);
  result.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
  return result;
}

function buildPeriods(
  startTime: Date,
  endTime: Date,
  breaks: BreakInterval[]
): { startTime: Date; endTime: Date; duration: number }[] {
  if (breaks.length === 0) {
    const dur = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    return [{ startTime: new Date(startTime), endTime: new Date(endTime), duration: dur }];
  }

  const periods: { startTime: Date; endTime: Date; duration: number }[] = [];
  let cursor = new Date(startTime);

  for (const brk of breaks) {
    if (brk.start.getTime() > cursor.getTime()) {
      const dur = Math.round((brk.start.getTime() - cursor.getTime()) / 1000);
      if (dur > 0) {
        periods.push({ startTime: new Date(cursor), endTime: new Date(brk.start), duration: dur });
      }
    }
    cursor = new Date(brk.end);
  }

  if (endTime.getTime() > cursor.getTime()) {
    const dur = Math.round((endTime.getTime() - cursor.getTime()) / 1000);
    if (dur > 0) {
      periods.push({ startTime: new Date(cursor), endTime: new Date(endTime), duration: dur });
    }
  }

  return periods;
}

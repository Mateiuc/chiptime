/**
 * Shared bill PDF renderer.
 *
 * "Bill" vs "Invoice" — terminology used across this codebase:
 *   - Bill   = customer-facing receipt with company decoration (logo,
 *              background art, photos). Generated here, surfaced via the
 *              mobile TaskCard "Generate Bill" flow and the desktop
 *              dashboard's bill action. Sent to clients.
 *   - Invoice = formal accounting document for the shop's records,
 *               line-item driven, no decoration. See
 *               `src/components/DesktopInvoiceView.tsx`.
 *
 * UI strings ("Bill saved as ...", "Generate Bill") must match the document
 * type actually rendered. Do not use "Invoice" wording for the output of
 * this renderer.
 */

import jsPDF from 'jspdf';
import type { Task, Client, Vehicle, SessionPhoto, Settings as SettingsType } from '@/types';
import { formatCurrency } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';
import { stripDiacritics } from '@/lib/pdfUtils';
import { computeSessionLaborDetails, computeSessionParts, ceilDollars, resolveRates } from '@/lib/billing';
import { photoStorageService } from '@/services/photoStorageService';
import {
  paintBillBackground,
  safeTop,
  safeBottom,
  RIGHT_MARGIN_MM,
  LEFT_MARGIN_MM,
  PAGE_CENTER_X_MM,
  PAGE_H,
  type PageRole,
} from '@/lib/billPdfLayout';

export interface RendererSettings {
  defaultHourlyRate: number;
  defaultCloningRate?: number;
  defaultProgrammingRate?: number;
  defaultAddKeyRate?: number;
  defaultAllKeysLostRate?: number;
}

export interface BillTotals {
  hourlyRate: number;
  baseLabor: number;
  totalMinHourAdj: number;
  totalCloning: number;
  totalProgramming: number;
  totalAddKey: number;
  totalAllKeysLost: number;
  minHourCount: number;
  cloningCount: number;
  programmingCount: number;
  addKeyCount: number;
  allKeysLostCount: number;
  rawLabor: number;
  laborDiscount: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
}

export function computeBillTotals(
  task: Task,
  client: Client | undefined,
  vehicle: Vehicle | undefined,
  settings: RendererSettings,
): BillTotals {
  // Build a SettingsType-shaped value so computeSessionLaborDetails / resolveRates
  // pick up every fallback rate (RendererSettings is a structural subset).
  const settingsForBilling = settings as unknown as SettingsType;
  const hourlyRate = resolveRates(client ?? null, settingsForBilling).hourly;

  let baseLabor = 0;
  let totalMinHourAdj = 0;
  let totalCloning = 0;
  let totalProgramming = 0;
  let totalAddKey = 0;
  let totalAllKeysLost = 0;
  let minHourCount = 0;
  let cloningCount = 0;
  let programmingCount = 0;
  let addKeyCount = 0;
  let allKeysLostCount = 0;

  (task.sessions || []).forEach((session) => {
    const d = computeSessionLaborDetails(session, client ?? null, settingsForBilling);
    baseLabor += d.baseLabor;
    minHourCount += (session.periods || []).filter(p => p.chargeMinimumHour && p.duration < 3600).length;
    if (d.minHourAdj > 0) {
      totalMinHourAdj += d.minHourAdj;
      minHourCount++;
    }
    if (d.cloning > 0) { totalCloning += d.cloning; cloningCount++; }
    if (d.programming > 0) { totalProgramming += d.programming; programmingCount++; }
    if (d.addKey > 0) { totalAddKey += d.addKey; addKeyCount++; }
    if (d.allKeysLost > 0) { totalAllKeysLost += d.allKeysLost; allKeysLostCount++; }
  });

  const rawLabor = baseLabor + totalMinHourAdj + totalCloning + totalProgramming + totalAddKey + totalAllKeysLost;
  const partsCost = (task.sessions || []).reduce(
    (total, session) => total + computeSessionParts(session),
    0,
  );
  const { discount: laborDiscount, laborAfter: laborCost } = applyLaborDiscount(rawLabor, vehicle);
  const totalCost = ceilDollars(laborCost + partsCost);

  return {
    hourlyRate, baseLabor, totalMinHourAdj, totalCloning, totalProgramming,
    totalAddKey, totalAllKeysLost, minHourCount, cloningCount, programmingCount,
    addKeyCount, allKeysLostCount, rawLabor, laborDiscount, laborCost, partsCost, totalCost,
  };
}

const formatDurationHHMM = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export interface RenderBillOptions {
  task: Task;
  client: Client | undefined;
  vehicle: Vehicle | undefined;
  settings: RendererSettings;
  billedDate?: Date;
}

// Layout constants — used by both measure and draw passes.
const COL1_X = 20;
const COL2_X = 150;
const COL3_X = 190.9;
const TIME_COL_WIDTH = 14; // mm — reserved width for right-aligned TIME values
const COL1_WIDTH = COL2_X - COL1_X - TIME_COL_WIDTH - 2; // = 114
const TOTALS_ANCHOR_Y = 240;       // mm — bottom-right anchor on last/single page
const TOTALS_LABEL_X = 130;        // mm — totals labels start
const TOTALS_VALUE_X = COL3_X;     // mm — totals values right-align
const TABLE_TOP = 66;
const ROW_LINE_HEIGHT = 6;
const ROW_VPAD = 2;
const ROW_GAP = 2;
const PART_ROW_GAP = 0;         // overrides ROW_GAP for inter-part spacing
const ORPHAN_TOLERANCE = 8; // mm

// One unit of flow content: an item to be rendered as a line in the table.
type FlowRow =
  | { kind: 'session'; description: string; time: string; amount: string }
  | { kind: 'option'; label: string; amount: string }
  | { kind: 'job'; name: string; description: string | null; amount: string }
  | { kind: 'part'; name: string; description: string | null; quantity: string; amount: string };

interface MeasuredRow {
  row: FlowRow;
  wrappedDesc: string[];
  wrappedPartDesc: string[];
  height: number;
}

/**
 * Measure a row's wrapped lines and total height. Caller must have set
 * font/size to the row's primary style (helvetica normal 11) before invoking.
 */
function measureRow(doc: jsPDF, row: FlowRow): MeasuredRow {
  if (row.kind === 'session') {
    const wrapped = doc.splitTextToSize(row.description, COL1_WIDTH) as string[];
    const lines = Math.max(1, wrapped.length);
    const height = lines * ROW_LINE_HEIGHT + ROW_VPAD + ROW_GAP;
    return { row, wrappedDesc: wrapped, wrappedPartDesc: [], height };
  }
  if (row.kind === 'option') {
    return { row, wrappedDesc: [row.label], wrappedPartDesc: [], height: ROW_LINE_HEIGHT + ROW_VPAD + ROW_GAP };
  }
  if (row.kind === 'job') {
    // Wrap combined "Name — description" like session rows.
    const combined = row.description ? `${row.name} — ${row.description}` : row.name;
    const wrapped = doc.splitTextToSize(combined, COL1_WIDTH + TIME_COL_WIDTH) as string[];
    const lines = Math.max(1, wrapped.length);
    return { row, wrappedDesc: wrapped, wrappedPartDesc: [], height: lines * ROW_LINE_HEIGHT + ROW_VPAD + ROW_GAP };
  }
  // part — uniform single-line height; condition renders inline
  const height = ROW_LINE_HEIGHT + ROW_VPAD + PART_ROW_GAP;
  return { row, wrappedDesc: [row.name], wrappedPartDesc: [], height };
}

export async function renderBillPdf(opts: RenderBillOptions): Promise<jsPDF> {
  const { task, client, vehicle, settings } = opts;
  const totals = computeBillTotals(task, client, vehicle, settings);
  const settingsForBilling = settings as unknown as SettingsType;

  const doc = new jsPDF({ format: 'letter' });

  // ----- Build flow rows -----
  const flowRows: FlowRow[] = [];
  (task.sessions || []).forEach((session) => {
    const sessionDuration = (session.periods || []).reduce((t, p) => t + p.duration, 0);
    // Single source of truth: time-based labor portion only (services and
    // min-hour adjustments render as separate option rows so the breakdown
    // stays itemised and reconciles to the totals block).
    const d = computeSessionLaborDetails(session, client ?? null, settingsForBilling);
    flowRows.push({
      kind: 'session',
      description: stripDiacritics(session.description || 'Work session'),
      time: formatDurationHHMM(sessionDuration),
      amount: formatCurrency(d.baseLabor),
    });
  });
  if (totals.totalMinHourAdj > 0) flowRows.push({ kind: 'option', label: `Min 1 Hour adjustment (x${totals.minHourCount})`, amount: formatCurrency(totals.totalMinHourAdj) });
  if (totals.totalCloning > 0) flowRows.push({ kind: 'option', label: `Cloning (x${totals.cloningCount})`, amount: formatCurrency(totals.totalCloning) });
  if (totals.totalProgramming > 0) flowRows.push({ kind: 'option', label: `Programming (x${totals.programmingCount})`, amount: formatCurrency(totals.totalProgramming) });
  if (totals.totalAddKey > 0) flowRows.push({ kind: 'option', label: `Add Key (x${totals.addKeyCount})`, amount: formatCurrency(totals.totalAddKey) });
  if (totals.totalAllKeysLost > 0) flowRows.push({ kind: 'option', label: `All Keys Lost (x${totals.allKeysLostCount})`, amount: formatCurrency(totals.totalAllKeysLost) });

  const allParts = (task.sessions || []).reduce(
    (acc, s) => acc.concat(s.parts || []),
    [] as NonNullable<Task['sessions'][number]['parts']>,
  );
  allParts.forEach((part) => {
    // Honor providedByClient — these parts contribute $0 to the totals block
    // (via computeSessionParts); the itemised row must also show $0 so the
    // detail rows reconcile to TOTAL.
    const condition = (part.description || '').trim();
    const isClientSupplied = !!part.providedByClient;
    const descParts = [
      condition || null,
      isClientSupplied ? 'client supplied' : null,
    ].filter(Boolean) as string[];
    flowRows.push({
      kind: 'part',
      name: stripDiacritics(part.name),
      description: descParts.length > 0 ? stripDiacritics(descParts.join(' · ')) : null,
      quantity: `${part.quantity}`,
      amount: formatCurrency(isClientSupplied ? 0 : part.price * part.quantity),
    });
  });

  // ----- Measure pass -----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const measured: MeasuredRow[] = flowRows.map((r) => measureRow(doc, r));

  const deposit = vehicle?.prepaidAmount || 0;
  const showDiscount = totals.laborDiscount > 0;
  const showDeposit = deposit > 0;
  const extraLines = (showDiscount ? 1 : 0) + (showDeposit ? 1 : 0);
  const totalsHeight = 9 /* subtotal */ + (showDiscount ? 7 : 0) + (showDeposit ? 8 : 0) + 10 /* TOTAL */;

  // ----- Pass A: simulate page sequence -----
  const HEADER_BAND = 16; // space for the DESC/TIME/AMOUNT header below safeTop
  const TOTALS_GAP = 4;

  const pageStartY = (role: PageRole) => safeTop(role) + HEADER_BAND;

  type PlannedPage = { role: PageRole; rows: MeasuredRow[]; totalsHere: boolean };
  const plan: PlannedPage[] = [];

  const totalContentHeight = measured.reduce((s, m) => s + m.height, 0) + TOTALS_GAP + totalsHeight;
  const fitsSingle = pageStartY('single') + totalContentHeight <= safeBottom('single');

  if (fitsSingle) {
    plan.push({ role: 'single', rows: measured.slice(), totalsHere: true });
  } else {
    let current: PlannedPage = { role: 'first', rows: [], totalsHere: false };
    let y = pageStartY('first');
    for (let i = 0; i < measured.length; i++) {
      const m = measured[i];
      const isLast = i === measured.length - 1;
      const overflow = y + m.height - safeBottom(current.role);
      if (overflow > 0) {
        const allowOrphan =
          isLast &&
          current.role !== 'first' &&
          overflow <= ORPHAN_TOLERANCE;
        if (!allowOrphan) {
          plan.push(current);
          current = { role: 'middle', rows: [], totalsHere: false };
          y = pageStartY('middle');
        }
      }
      current.rows.push(m);
      y += m.height;
    }
    // Decide whether the trailing page can host the totals when re-typed as 'last'.
    const trailingStartY = pageStartY(current.role);
    const trailingUsedHeight = current.rows.reduce((s, m) => s + m.height, 0);
    const yAfterRows = trailingStartY + trailingUsedHeight;
    if (yAfterRows + TOTALS_GAP + totalsHeight <= safeBottom('last')) {
      current.role = 'last';
      current.totalsHere = true;
      plan.push(current);
    } else {
      plan.push(current);
      plan.push({ role: 'last', rows: [], totalsHere: true });
    }
  }

  // ----- Pass B: draw -----
  const drawTableHeader = (d: jsPDF, top: number) => {
    d.setFontSize(16);
    d.setFont('helvetica', 'bold');
    d.setTextColor(0, 0, 0);
    d.text('DESCRIPTION', 25, top + 6);
    d.text('TIME', COL2_X, top + 6, { align: 'right' });
    d.text('AMOUNT', COL3_X, top + 6, { align: 'right' });
    d.setLineWidth(0.3);
    d.setDrawColor(255, 0, 0);
    d.line(LEFT_MARGIN_MM, top + 8, RIGHT_MARGIN_MM, top + 8);
    d.setFontSize(11);
    d.setFont('helvetica', 'normal');
  };

  const cursor = { yPos: 0 };

  // Dotted leader between label end and value start; leaves ~2mm gutters.
  const drawDottedLeader = (labelEndX: number, valueStartX: number, y: number) => {
    const start = labelEndX + 1.5;
    const end = valueStartX - 1.5;
    if (end <= start + 2) return;
    const dotStep = 1.5;
    doc.setTextColor(120, 120, 120);
    for (let x = start; x <= end; x += dotStep) {
      doc.text('.', x, y);
    }
    doc.setTextColor(0, 0, 0);
  };

  const drawMeasured = (m: MeasuredRow) => {
    const startY = cursor.yPos;
    const r = m.row;
    if (r.kind === 'session') {
      m.wrappedDesc.forEach((line, i) => {
        doc.text(line, COL1_X + 2, startY + i * ROW_LINE_HEIGHT);
      });
      doc.text(r.time, COL2_X, startY, { align: 'right' });
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
    } else if (r.kind === 'option') {
      doc.text(r.label, COL1_X + 2, startY);
      const labelEndX = COL1_X + 2 + doc.getTextWidth(r.label);
      drawDottedLeader(labelEndX, COL3_X - doc.getTextWidth(r.amount), startY);
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
    } else if (r.kind === 'job') {
      const lastLine = m.wrappedDesc[m.wrappedDesc.length - 1] || '';
      m.wrappedDesc.forEach((line, i) => {
        doc.text(line, COL1_X + 2, startY + i * ROW_LINE_HEIGHT);
      });
      const lastLineY = startY + (m.wrappedDesc.length - 1) * ROW_LINE_HEIGHT;
      const labelEndX = COL1_X + 2 + doc.getTextWidth(lastLine);
      drawDottedLeader(labelEndX, COL3_X - doc.getTextWidth(r.amount), lastLineY);
      doc.text(r.amount, COL3_X + 2, lastLineY, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(r.name, COL1_X + 2, startY);
      if (r.description) {
        const nameWidth = doc.getTextWidth(r.name);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(` (${r.description})`, COL1_X + 2 + nameWidth, startY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      }
      doc.text(r.quantity, COL2_X, startY, { align: 'right' });
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
    }
    cursor.yPos = startY + m.height;
  };


  for (let pageIdx = 0; pageIdx < plan.length; pageIdx++) {
    const page = plan[pageIdx];
    if (pageIdx > 0) doc.addPage();
    paintBillBackground(doc, page.role);

    // First-page header block (Bill to / billed-on / client / vehicle).
    if (pageIdx === 0 && (page.role === 'single' || page.role === 'first')) {
      doc.setFontSize(17);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(128, 0, 128);
      doc.text('Bill to:', 20, 48.5);

      const billedDateStr = (opts.billedDate ?? new Date()).toLocaleDateString('en-US');
      doc.text(`Billed on ${billedDateStr}`, RIGHT_MARGIN_MM, 58.5, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      let clientLine = client?.companyName || client?.name || 'N/A';
      if (client?.companyName) {
        const addrParts = [client.address, client.city, client.state, client.zip].filter(Boolean);
        if (addrParts.length > 0) clientLine = `${client.companyName} - ${addrParts.join(', ')}`;
      }
      doc.text(stripDiacritics(clientLine), 20, 53);

      const vehicleLabel = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
      const vinInfo = vehicle?.vin ? `(VIN: ${vehicle.vin})` : '';
      const fullVehicleInfo = vehicleLabel ? `${vehicleLabel} ${vinInfo}` : 'Vehicle Info Not Available';
      doc.text(stripDiacritics(fullVehicleInfo), 20, 58.5);
    }

    // Repeat the column header on every page.
    if (page.rows.length > 0) {
      drawTableHeader(doc, safeTop(page.role));
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    cursor.yPos = pageStartY(page.role);
    for (const m of page.rows) drawMeasured(m);

    if (page.totalsHere) {
      // Anchor totals to bottom-right of last/single page (do NOT advance content cursor).
      let yPos = TOTALS_ANCHOR_Y;
      const totalX = TOTALS_LABEL_X;

      if (extraLines > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Subtotal:', totalX, yPos);
        doc.text(formatCurrency(ceilDollars(totals.rawLabor + totals.partsCost)), TOTALS_VALUE_X + 2, yPos, { align: 'right' });
        yPos += 7;
        if (showDiscount) {
          doc.setFontSize(11);
          doc.setTextColor(22, 163, 74);
          const dLabel = vehicle?.discountType === 'percent'
            ? `Discount (${vehicle?.discountValue}%):`
            : 'Discount:';
          doc.text(dLabel, totalX, yPos);
          doc.text(`-${formatCurrency(totals.laborDiscount)}`, TOTALS_VALUE_X + 2, yPos, { align: 'right' });
          doc.setTextColor(0, 0, 0);
          yPos += 7;
        }
        if (showDeposit) {
          doc.setFontSize(11);
          doc.setTextColor(220, 38, 38);
          doc.text('Deposit:', totalX, yPos);
          doc.text(`-${formatCurrency(deposit)}`, TOTALS_VALUE_X + 2, yPos, { align: 'right' });
          doc.setTextColor(0, 0, 0);
          yPos += 8;
        }
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', totalX, yPos);
        doc.text(formatCurrency(Math.max(0, totals.totalCost - deposit)), TOTALS_VALUE_X + 2, yPos, { align: 'right' });
      } else {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('TOTAL:', totalX, yPos);
        doc.text(formatCurrency(totals.totalCost), TOTALS_VALUE_X + 2, yPos, { align: 'right' });
      }

      // Generated-at timestamp at the very bottom of the totals page.
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${formatTimestamp(new Date())}`, PAGE_CENTER_X_MM, PAGE_H - 2, { align: 'center' });
    }
  }

  // Photo pages.
  await renderPhotoPages(doc, task);

  // Daily time chart page.
  renderDailyTimeChart(doc, task);

  return doc;
}

// ---------- Daily time chart ----------

const formatHm = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const PERIOD_COLORS: [number, number, number][] = [
  [128, 0, 128],   // brand purple
  [37, 99, 235],   // blue
  [22, 163, 74],   // green
  [234, 88, 12],   // orange
  [220, 38, 38],   // red
  [202, 138, 4],   // amber
  [13, 148, 136],  // teal
  [219, 39, 119],  // pink
];

function renderDailyTimeChart(doc: jsPDF, task: Task): void {
  // Collect all periods with a global index (for stable per-period color).
  type FlatPeriod = { start: Date; seconds: number; globalIdx: number };
  const flat: FlatPeriod[] = [];
  let g = 0;
  (task.sessions || []).forEach((session) => {
    (session.periods || []).forEach((p) => {
      const start = p.startTime instanceof Date ? p.startTime : new Date(p.startTime);
      const dur = p.duration || 0;
      if (isNaN(start.getTime()) || dur <= 0) { g++; return; }
      flat.push({ start, seconds: dur, globalIdx: g });
      g++;
    });
  });
  if (flat.length === 0) return;

  // Bucket by local calendar day, preserving chronological order per day.
  const buckets = new Map<string, { date: Date; periods: FlatPeriod[] }>();
  flat.forEach((fp) => {
    const key = `${fp.start.getFullYear()}-${String(fp.start.getMonth() + 1).padStart(2, '0')}-${String(fp.start.getDate()).padStart(2, '0')}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: new Date(fp.start.getFullYear(), fp.start.getMonth(), fp.start.getDate()), periods: [] };
      buckets.set(key, bucket);
    }
    bucket.periods.push(fp);
  });

  const days = Array.from(buckets.values())
    .map((b) => ({
      date: b.date,
      periods: b.periods.slice().sort((a, b) => a.start.getTime() - b.start.getTime()),
      seconds: b.periods.reduce((s, p) => s + p.seconds, 0),
    }))
    .filter((d) => d.seconds > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (days.length === 0) return;

  doc.addPage();
  paintBillBackground(doc, 'middle');

  // Title.
  let y = safeTop('middle');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 128);
  doc.text('Time Worked per Day', PAGE_CENTER_X_MM, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Chart area.
  const chartLeft = LEFT_MARGIN_MM + 14;
  const chartRight = RIGHT_MARGIN_MM - 2;
  const chartTop = y + 4;
  const chartBottom = safeBottom('middle') - 24;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Y scale.
  const maxSec = Math.max(...days.map((d) => d.seconds));
  const maxHours = Math.max(0.5, Math.ceil((maxSec / 3600) * 2) / 2);
  const ySteps = 4;

  // Gridlines + Y labels.
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= ySteps; i++) {
    const frac = i / ySteps;
    const yy = chartBottom - frac * chartHeight;
    doc.line(chartLeft, yy, chartRight, yy);
    const hoursLabel = (maxHours * frac).toFixed(maxHours < 2 ? 2 : 1).replace(/\.?0+$/, '') || '0';
    doc.text(`${hoursLabel}h`, chartLeft - 2, yy + 1.2, { align: 'right' });
  }

  // Axes.
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(chartLeft, chartTop, chartLeft, chartBottom);
  doc.line(chartLeft, chartBottom, chartRight, chartBottom);

  // Stacked bars.
  const slotW = chartWidth / days.length;
  const barW = slotW * 0.7;
  const barOffset = (slotW - barW) / 2;
  const rotate = days.length > 8;

  days.forEach((d, i) => {
    const slotX = chartLeft + i * slotW;
    const bx = slotX + barOffset;
    const hFrac = (d.seconds / 3600) / maxHours;
    const bh = Math.max(0.6, hFrac * chartHeight);
    const by = chartBottom - bh;

    // Draw period segments from bottom up.
    let segBottom = chartBottom;
    d.periods.forEach((p, idx) => {
      const segH = (p.seconds / d.seconds) * bh;
      const segY = segBottom - segH;
      const [r, gg, b] = PERIOD_COLORS[p.globalIdx % PERIOD_COLORS.length];
      doc.setFillColor(r, gg, b);
      doc.rect(bx, segY, barW, segH, 'F');
      // White separator above this segment (skip top-most segment).
      if (idx < d.periods.length - 1) {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(bx, segY, bx + barW, segY);
      }
      segBottom = segY;
    });

    // Outline.
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(bx, by, barW, bh, 'S');

    // Value label above bar.
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(formatHm(d.seconds), bx + barW / 2, by - 1.5, { align: 'center' });

    // X-axis date label.
    const dateLabel = `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}`;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const lx = slotX + slotW / 2;
    const ly = chartBottom + 4;
    if (rotate) {
      doc.text(dateLabel, lx, ly + 2, { align: 'right', angle: 45 });
    } else {
      doc.text(dateLabel, lx, ly + 2, { align: 'center' });
    }
  });


  // Summary footer.
  const totalSec = days.reduce((s, d) => s + d.seconds, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Total: ${formatHm(totalSec)} across ${days.length} day${days.length === 1 ? '' : 's'}`,
    PAGE_CENTER_X_MM,
    chartBottom + 18,
    { align: 'center' },
  );
}


// ---------- Photo pages ----------

async function loadAndResize(base64: string, maxSide = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas ctx unavailable'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

async function fetchUrlAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${response.status}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function renderPhotoPages(doc: jsPDF, task: Task): Promise<void> {
  const allPhotos: Array<{ photo: SessionPhoto; sessionNum: number }> = [];
  (task.sessions || []).forEach((session, idx) => {
    (session.photos || []).forEach((photo) => {
      allPhotos.push({ photo, sessionNum: idx + 1 });
    });
  });
  if (allPhotos.length === 0) return;

  // Local IndexedDB / filesystem photos.
  const filePaths = allPhotos.map((it) => it.photo.filePath).filter((p): p is string => !!p);
  let photoDataMap = new Map<string, string>();
  if (filePaths.length > 0) {
    try {
      photoDataMap = await photoStorageService.loadMultiplePhotos(filePaths);
    } catch (e) {
      console.warn('[bill] local photos load failed:', e);
    }
  }

  // Pre-mint signed URLs for cloud photos.
  const cloudPaths = Array.from(new Set(
    allPhotos
      .map((it) => it.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(it.photo.cloudUrl))
      .filter((p): p is string => !!p),
  ));
  const cloudSigned = cloudPaths.length ? await photoStorageService.signPhotoUrls(cloudPaths) : {};

  // Resolve every photo to base64 (or null) BEFORE adding any pages.
  const resolved: Array<{ sessionNum: number; base64: string | null; failReason?: string }> = [];
  for (const item of allPhotos) {
    let b64: string | null = null;
    let failReason: string | undefined;
    try {
      // 1. legacy inline base64
      if (item.photo.base64) b64 = item.photo.base64;
      // 2. local storage
      if (!b64 && item.photo.filePath) b64 = photoDataMap.get(item.photo.filePath) ?? null;
      // 3. pre-signed cloud URL (batch result)
      const path = item.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(item.photo.cloudUrl);
      if (!b64 && path && cloudSigned[path]) {
        b64 = await fetchUrlAsBase64(cloudSigned[path]);
        if (!b64) failReason = 'signed-fetch-failed';
      }
      // 4. on-demand single-path sign retry (covers paths the batch missed)
      if (!b64 && path) {
        const retry = await photoStorageService.signPhotoUrls([path]);
        if (retry[path]) {
          b64 = await fetchUrlAsBase64(retry[path]);
          if (!b64) failReason = 'retry-sign-fetch-failed';
        } else {
          failReason = 'sign-denied';
        }
      }
      // 5. last-resort cloudUrl (works only if it's a still-valid signed URL;
      // /object/public/ URLs always 4xx now that the bucket is private).
      if (!b64 && item.photo.cloudUrl && !item.photo.cloudUrl.includes('/object/public/')) {
        b64 = await fetchUrlAsBase64(item.photo.cloudUrl);
        if (!b64) failReason = failReason || 'cloudurl-fetch-failed';
      }
      if (b64) b64 = await loadAndResize(b64);
    } catch (e) {
      console.warn('[bill] photo resolve failed:', e);
      b64 = null;
      failReason = failReason || 'exception';
    }
    resolved.push({ sessionNum: item.sessionNum, base64: b64, failReason });
  }

  const ok = resolved.filter((r) => r.base64);
  const failed = resolved.length - ok.length;
  if (failed > 0) {
    const reasons = resolved.filter(r => !r.base64).map(r => r.failReason || 'unknown');
    console.warn(`[bill] photos: ${ok.length} ok, ${failed} failed of ${resolved.length}`, reasons);
  } else {
    console.info(`[bill] photos: ${ok.length} ok of ${resolved.length}`);
  }
  if (ok.length === 0) return; // omit entire section

  // Render: middle-page background (logo only), two-column grid.
  const PHOTO_TOP = safeTop('middle');
  const PHOTO_BOTTOM = safeBottom('middle');
  doc.addPage();
  paintBillBackground(doc, 'middle');

  let y = PHOTO_TOP;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 128);
  doc.text('Work Photos', 105, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  const colWidth = 85;
  const colHeight = 75;
  const captionHeight = 6;
  const rowGap = 12;
  const colX = [15, 110];
  let colIdx = 0;

  for (const item of ok) {
    if (y + captionHeight + colHeight > PHOTO_BOTTOM) {
      doc.addPage();
      paintBillBackground(doc, 'middle');
      y = PHOTO_TOP;
      colIdx = 0;
    }
    const x = colX[colIdx];
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Session ${item.sessionNum}`, x, y);
    try {
      doc.addImage(`data:image/jpeg;base64,${item.base64}`, 'JPEG', x, y + 2, colWidth, colHeight);
    } catch (e) {
      console.warn('[bill] addImage failed:', e);
    }

    colIdx++;
    if (colIdx >= 2) {
      colIdx = 0;
      y += colHeight + rowGap;
    }
  }
}

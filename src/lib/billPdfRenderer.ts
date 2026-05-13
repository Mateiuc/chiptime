/**
 * Shared bill PDF renderer.
 *
 * Single source of truth for the branded bill/invoice PDF. Used by both the
 * mobile TaskCard and the Desktop dashboard.
 */

import jsPDF from 'jspdf';
import type { Task, Client, Vehicle, SessionPhoto } from '@/types';
import { calcPeriodCost, formatCurrency } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';
import { stripDiacritics } from '@/lib/pdfUtils';
import { photoStorageService } from '@/services/photoStorageService';
import {
  paintBillBackground,
  safeTop,
  safeBottom,
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
  const hourlyRate = client?.hourlyRate || settings.defaultHourlyRate;
  const cloningRate = client?.cloningRate || settings.defaultCloningRate || 0;
  const programmingRate = client?.programmingRate || settings.defaultProgrammingRate || 0;
  const addKeyRate = client?.addKeyRate || settings.defaultAddKeyRate || 0;
  const allKeysLostRate = client?.allKeysLostRate || settings.defaultAllKeysLostRate || 0;

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
    session.periods.forEach((period) => {
      if (period.chargeMinimumHour && period.duration < 3600) {
        baseLabor += Math.ceil(hourlyRate);
        minHourCount++;
      } else {
        baseLabor += calcPeriodCost(period.duration, hourlyRate);
      }
    });
    const sessionDur = session.periods.reduce((sum, p) => sum + p.duration, 0);
    const hasPeriodFlags = session.periods.some((p) => p.chargeMinimumHour);
    if (!hasPeriodFlags && session.chargeMinimumHour && sessionDur < 3600) {
      totalMinHourAdj += Math.ceil(((3600 - sessionDur) / 3600) * hourlyRate);
      minHourCount++;
    }
    if (session.isCloning && cloningRate > 0) { totalCloning += cloningRate; cloningCount++; }
    if (session.isProgramming && programmingRate > 0) { totalProgramming += programmingRate; programmingCount++; }
    if (session.isAddKey && addKeyRate > 0) { totalAddKey += addKeyRate; addKeyCount++; }
    if (session.isAllKeysLost && allKeysLostRate > 0) { totalAllKeysLost += allKeysLostRate; allKeysLostCount++; }
  });

  const rawLabor = baseLabor + totalMinHourAdj + totalCloning + totalProgramming + totalAddKey + totalAllKeysLost;
  const partsCost = (task.sessions || []).reduce((total, session) => {
    return total + (session.parts || []).reduce(
      (sum, p) => sum + (p.providedByClient ? 0 : p.price * p.quantity),
      0,
    );
  }, 0);
  const { discount: laborDiscount, laborAfter: laborCost } = applyLaborDiscount(rawLabor, vehicle);
  const totalCost = Math.ceil(laborCost + partsCost);

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
const COL2_X = 130;
const COL3_X = 190.9;
const COL1_WIDTH = COL2_X - COL1_X - 4;
const TABLE_TOP = 66;
const ROW_LINE_HEIGHT = 6;
const ROW_VPAD = 2;
const ROW_GAP = 2;
const ORPHAN_TOLERANCE = 8; // mm

// One unit of flow content: an item to be rendered as a line in the table.
type FlowRow =
  | { kind: 'session'; description: string; time: string; amount: string }
  | { kind: 'option'; label: string; amount: string }
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
  // part
  let wrappedPartDesc: string[] = [];
  let extra = 0;
  if (row.description) {
    wrappedPartDesc = doc.splitTextToSize(row.description, COL1_WIDTH - 2) as string[];
    extra = 4 + wrappedPartDesc.length * 5;
  }
  const height = ROW_LINE_HEIGHT + ROW_VPAD + extra + ROW_GAP;
  return { row, wrappedDesc: [row.name], wrappedPartDesc, height };
}

export async function renderBillPdf(opts: RenderBillOptions): Promise<jsPDF> {
  const { task, client, vehicle, settings } = opts;
  const totals = computeBillTotals(task, client, vehicle, settings);

  const doc = new jsPDF({ format: 'letter' });

  // ----- Build flow rows -----
  const flowRows: FlowRow[] = [];
  (task.sessions || []).forEach((session) => {
    const sessionDuration = (session.periods || []).reduce((t, p) => t + p.duration, 0);
    const sessionCost = (sessionDuration / 3600) * totals.hourlyRate;
    flowRows.push({
      kind: 'session',
      description: stripDiacritics(session.description || 'Work session'),
      time: formatDurationHHMM(sessionDuration),
      amount: formatCurrency(sessionCost),
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
    flowRows.push({
      kind: 'part',
      name: stripDiacritics(part.name),
      description: part.description ? stripDiacritics(part.description) : null,
      quantity: `${part.quantity}`,
      amount: formatCurrency(part.price * part.quantity),
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

  // Decide page-1 background: does the entire bill fit on a single decorative page?
  const startY = TABLE_TOP + 16;
  const totalContentHeight = measured.reduce((s, m) => s + m.height, 0) + 4 /* gap */ + totalsHeight;
  const fitsOnePage = startY + totalContentHeight <= safeBottom('decorative');
  const page1Mode = fitsOnePage ? 'decorative' : 'clean';

  // ----- Render -----
  paintBillBackground(doc, page1Mode);

  // Header block.
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 128);
  doc.text('Bill to:', 20, 48.5);

  const billedDateStr = (opts.billedDate ?? new Date()).toLocaleDateString('en-US');
  doc.text(`Billed on ${billedDateStr}`, 195.9, 58.5, { align: 'right' });

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

  const drawTableHeader = (d: jsPDF, top: number) => {
    d.setFontSize(16);
    d.setFont('helvetica', 'bold');
    d.setTextColor(0, 0, 0);
    d.text('DESCRIPTION', 25, top + 6);
    d.text('TIME', COL2_X - 1, top + 6);
    d.text('AMOUNT', 190.9, top + 6, { align: 'right' });
    d.setLineWidth(0.3);
    d.setDrawColor(255, 0, 0);
    d.line(20, top + 8, 195.9, top + 8);
    d.setFontSize(11);
    d.setFont('helvetica', 'normal');
  };
  drawTableHeader(doc, TABLE_TOP);

  const cursor: BillLayoutCursor = {
    doc,
    yPos: TABLE_TOP + 16,
    bgMode: page1Mode,
    drawContinuationHeader: (d) => {
      drawTableHeader(d, CONTENT_TOP - 6);
      cursor.yPos = CONTENT_TOP + 10;
    },
  };

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // Single drawRow used for all measured rows.
  const drawMeasured = (m: MeasuredRow) => {
    const startY = cursor.yPos;
    const r = m.row;
    if (r.kind === 'session') {
      m.wrappedDesc.forEach((line, i) => {
        doc.text(line, COL1_X + 2, startY + i * ROW_LINE_HEIGHT);
      });
      doc.text(r.time, COL2_X + 2, startY);
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
    } else if (r.kind === 'option') {
      doc.text(r.label, COL1_X + 2, startY);
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.text(r.name, COL1_X + 2, startY);
      doc.text(r.quantity, COL2_X + 2, startY);
      doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
      if (m.wrappedPartDesc.length > 0) {
        let y = startY + ROW_LINE_HEIGHT;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        m.wrappedPartDesc.forEach((line) => {
          doc.text(line, COL1_X + 4, y);
          y += 5;
        });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
      }
    }
    cursor.yPos = startY + m.height;
  };

  // Flow loop with orphan-row prevention.
  for (let i = 0; i < measured.length; i++) {
    const m = measured[i];
    const remaining = measured.length - i; // including current
    const overflow = cursor.yPos + m.height - safeBottom(cursor.bgMode);

    if (overflow > 0) {
      // Orphan rule: if this is the very last row AND it would overflow by
      // ≤ ORPHAN_TOLERANCE on a non-decorative page, draw it inline rather
      // than open a near-empty new page.
      const isLast = remaining === 1;
      const allowRelax = isLast && cursor.bgMode === 'clean' && overflow <= ORPHAN_TOLERANCE;
      if (!allowRelax) {
        cursor.yPos = ensureRoom(cursor, m.height);
      }
    }
    drawMeasured(m);
  }

  // Gap before totals.
  cursor.yPos += 4;

  // Totals block — try to keep on current decorative page; else new page.
  const newPage = ensureDecorativeFinalPage(cursor, totalsHeight);
  const totalX = COL3_X - 45;
  let yPos = newPage ? (TOTAL_BLOCK_Y - 7 * extraLines) : cursor.yPos;

  if (extraLines > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Subtotal:', totalX, yPos);
    doc.text(formatCurrency(Math.ceil(totals.rawLabor + totals.partsCost)), COL3_X + 2, yPos, { align: 'right' });
    yPos += 7;
    if (showDiscount) {
      doc.setFontSize(11);
      doc.setTextColor(22, 163, 74);
      const dLabel = vehicle?.discountType === 'percent'
        ? `Discount (${vehicle?.discountValue}%):`
        : 'Discount:';
      doc.text(dLabel, totalX, yPos);
      doc.text(`-${formatCurrency(totals.laborDiscount)}`, COL3_X + 2, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 7;
    }
    if (showDeposit) {
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text('Deposit:', totalX, yPos);
      doc.text(`-${formatCurrency(deposit)}`, COL3_X + 2, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalX, yPos);
    doc.text(formatCurrency(Math.max(0, totals.totalCost - deposit)), COL3_X + 2, yPos, { align: 'right' });
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL:', totalX, yPos);
    doc.text(formatCurrency(totals.totalCost), COL3_X + 2, yPos, { align: 'right' });
  }

  // Generated-at timestamp at the very bottom of the totals page.
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${formatTimestamp(new Date())}`, 107.95, 277.4, { align: 'center' });

  // Photo pages.
  await renderPhotoPages(doc, task);

  return doc;
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
  const resolved: Array<{ sessionNum: number; base64: string | null }> = [];
  for (const item of allPhotos) {
    let b64: string | null = null;
    try {
      // 1. legacy inline base64
      if (item.photo.base64) b64 = item.photo.base64;
      // 2. local storage
      if (!b64 && item.photo.filePath) b64 = photoDataMap.get(item.photo.filePath) ?? null;
      // 3. pre-signed cloud URL
      if (!b64) {
        const path = item.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(item.photo.cloudUrl);
        if (path && cloudSigned[path]) b64 = await fetchUrlAsBase64(cloudSigned[path]);
      }
      // 4. public cloudUrl
      if (!b64 && item.photo.cloudUrl && item.photo.cloudUrl.includes('/object/public/')) {
        b64 = await fetchUrlAsBase64(item.photo.cloudUrl);
      }
      // 5. on-demand single-path sign retry
      if (!b64) {
        const path = item.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(item.photo.cloudUrl);
        if (path) {
          const retry = await photoStorageService.signPhotoUrls([path]);
          if (retry[path]) b64 = await fetchUrlAsBase64(retry[path]);
        }
      }
      // 6. last-known signed URL (might still be valid)
      if (!b64 && item.photo.cloudUrl) {
        b64 = await fetchUrlAsBase64(item.photo.cloudUrl);
      }
      if (b64) b64 = await loadAndResize(b64);
    } catch (e) {
      console.warn('[bill] photo resolve failed:', e);
      b64 = null;
    }
    resolved.push({ sessionNum: item.sessionNum, base64: b64 });
  }

  const ok = resolved.filter((r) => r.base64);
  const failed = resolved.length - ok.length;
  console.info(`[bill] photos: ${ok.length} ok, ${failed} failed of ${resolved.length}`);
  if (ok.length === 0) return; // omit entire section

  // Render: clean background, two-column grid, anchored below header.
  doc.addPage();
  paintBillBackground(doc, 'clean');

  let y = CONTENT_TOP;
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
    if (y + captionHeight + colHeight > SAFE_BOTTOM_CLEAN) {
      doc.addPage();
      paintBillBackground(doc, 'clean');
      y = CONTENT_TOP;
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

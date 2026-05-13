/**
 * Shared bill PDF renderer.
 *
 * Single source of truth for the branded bill/invoice PDF. Used by both the
 * mobile TaskCard (Generate Bill / Preview Bill / Share) and the Desktop
 * dashboard (Generate Bill & Mark Billed / Preview Bill).
 *
 * Responsibilities:
 *   - Compute labor / option / parts / discount / deposit figures (Phase 1
 *     billing model: live labor + services + parts, ignore importedSalary).
 *   - Render header (Bill to / vehicle / billed-on date).
 *   - Render the line-item table with safe-area-aware page breaks via the
 *     billPdfLayout helpers (parts and options never collide with the flag /
 *     "Thank you" decorative footer).
 *   - Render the closing TOTAL block on a decorative page, regardless of how
 *     many continuation pages the line items required.
 *   - Append photo pages (always with the clean continuation background) and
 *     try local IndexedDB → cloud signed URL → public URL fallbacks.
 *
 * Diagnostic-PDF merging and the actual save/share step stay at the call
 * site — they differ between mobile and desktop.
 */

import jsPDF from 'jspdf';
import type { Task, Client, Vehicle, SessionPhoto } from '@/types';
import { calcPeriodCost, formatCurrency } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';
import { stripDiacritics } from '@/lib/pdfUtils';
import { photoStorageService } from '@/services/photoStorageService';
import {
  paintBillBackground,
  ensureRoom,
  ensureDecorativeFinalPage,
  CONTENT_TOP,
  TOTAL_BLOCK_Y,
  type BillLayoutCursor,
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

/**
 * Phase-1 billing math (mirrors TaskCard's component-level computation).
 */
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
    hourlyRate,
    baseLabor,
    totalMinHourAdj,
    totalCloning,
    totalProgramming,
    totalAddKey,
    totalAllKeysLost,
    minHourCount,
    cloningCount,
    programmingCount,
    addKeyCount,
    allKeysLostCount,
    rawLabor,
    laborDiscount,
    laborCost,
    partsCost,
    totalCost,
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
  /** Override for the "Billed on" date label. Defaults to today. */
  billedDate?: Date;
}

/**
 * Render a complete branded bill PDF (header, line items, options, parts,
 * totals, timestamp, photos) and return the jsPDF doc. Caller handles save,
 * share, and any diagnostic-PDF merge.
 */
export async function renderBillPdf(opts: RenderBillOptions): Promise<jsPDF> {
  const { task, client, vehicle, settings } = opts;
  const totals = computeBillTotals(task, client, vehicle, settings);

  const doc = new jsPDF({ format: 'letter' });

  // Page 1 — full decorative background (BILL header + flag + "Thank you").
  paintBillBackground(doc, 'decorative');

  // Header block: Bill to / client / vehicle / billed-on date.
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

  // Table.
  const tableTop = 66;
  const col1X = 20;
  const col2X = 130;
  const col3X = 190.9;

  const drawTableHeader = (d: jsPDF, top: number) => {
    d.setFontSize(16);
    d.setFont('helvetica', 'bold');
    d.setTextColor(0, 0, 0);
    d.text('DESCRIPTION', 25, top + 6);
    d.text('TIME', col2X - 1, top + 6);
    d.text('AMOUNT', 190.9, top + 6, { align: 'right' });
    d.setLineWidth(0.3);
    d.setDrawColor(255, 0, 0);
    d.line(20, top + 8, 195.9, top + 8);
  };
  drawTableHeader(doc, tableTop);

  const cursor: BillLayoutCursor = {
    doc,
    yPos: tableTop + 16,
    bgMode: 'decorative',
    drawContinuationHeader: (d) => {
      drawTableHeader(d, CONTENT_TOP);
      cursor.yPos = CONTENT_TOP + 16;
    },
  };

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // Sessions (labor rows).
  (task.sessions || []).forEach((session) => {
    const sessionDuration = (session.periods || []).reduce((t, p) => t + p.duration, 0);
    const sessionCost = (sessionDuration / 3600) * totals.hourlyRate;
    const description = stripDiacritics(session.description || 'Work session');
    const col1Width = col2X - col1X - 4;
    const wrapped = doc.splitTextToSize(description, col1Width);
    const rowHeight = Math.max(8, 6 * (wrapped.length - 1) + 8);
    cursor.yPos = ensureRoom(cursor, rowHeight);
    const startY = cursor.yPos;
    let y = cursor.yPos;
    wrapped.forEach((line: string, i: number) => {
      doc.text(line, col1X + 2, y);
      if (i < wrapped.length - 1) y += 6;
    });
    doc.text(formatDurationHHMM(sessionDuration), col2X + 2, startY);
    doc.text(formatCurrency(sessionCost), col3X + 2, startY, { align: 'right' });
    cursor.yPos = y + 8;
  });

  // Option rows.
  const renderOptionRow = (label: string, amount: number) => {
    cursor.yPos = ensureRoom(cursor, 8);
    doc.text(label, col1X + 2, cursor.yPos);
    doc.text(formatCurrency(amount), col3X + 2, cursor.yPos, { align: 'right' });
    cursor.yPos += 8;
  };
  if (totals.totalMinHourAdj > 0) renderOptionRow(`Min 1 Hour adjustment (x${totals.minHourCount})`, totals.totalMinHourAdj);
  if (totals.totalCloning > 0) renderOptionRow(`Cloning (x${totals.cloningCount})`, totals.totalCloning);
  if (totals.totalProgramming > 0) renderOptionRow(`Programming (x${totals.programmingCount})`, totals.totalProgramming);
  if (totals.totalAddKey > 0) renderOptionRow(`Add Key (x${totals.addKeyCount})`, totals.totalAddKey);
  if (totals.totalAllKeysLost > 0) renderOptionRow(`All Keys Lost (x${totals.allKeysLostCount})`, totals.totalAllKeysLost);

  // Parts.
  const allParts = (task.sessions || []).reduce(
    (acc, s) => acc.concat(s.parts || []),
    [] as NonNullable<Task['sessions'][number]['parts']>,
  );
  if (allParts.length > 0) {
    doc.setFontSize(11);
    allParts.forEach((part) => {
      let estDescLines = 0;
      let wrappedPartDesc: string[] = [];
      if (part.description) {
        const col1Width = col2X - col1X - 6;
        wrappedPartDesc = doc.splitTextToSize(stripDiacritics(part.description), col1Width);
        estDescLines = wrappedPartDesc.length;
      }
      const rowHeight = 8 + (estDescLines > 0 ? 6 + 5 * (estDescLines - 1) + 2 : 0);
      cursor.yPos = ensureRoom(cursor, rowHeight);

      const partNameY = cursor.yPos;
      doc.setFont('helvetica', 'normal');
      doc.text(stripDiacritics(part.name), col1X + 2, partNameY);

      if (estDescLines > 0) {
        cursor.yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        wrappedPartDesc.forEach((line, i) => {
          doc.text(line, col1X + 4, cursor.yPos);
          if (i < wrappedPartDesc.length - 1) cursor.yPos += 5;
        });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        cursor.yPos += 2;
      }
      doc.text(`${part.quantity}`, col2X + 2, partNameY);
      doc.text(formatCurrency(part.price * part.quantity), col3X + 2, partNameY, { align: 'right' });
      cursor.yPos += 8;
    });
  }

  // Gap between content and the totals block.
  cursor.yPos += 4;

  // Totals block must land on a decorative page (flag + Thank you).
  ensureDecorativeFinalPage(cursor);

  const deposit = vehicle?.prepaidAmount || 0;
  const showDiscount = totals.laborDiscount > 0;
  const showDeposit = deposit > 0;
  const extraLines = (showDiscount ? 1 : 0) + (showDeposit ? 1 : 0);
  let yPos = TOTAL_BLOCK_Y - 7 * extraLines;
  const totalX = col3X - 45;

  if (extraLines > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', totalX, yPos);
    doc.text(formatCurrency(Math.ceil(totals.rawLabor + totals.partsCost)), col3X + 2, yPos, { align: 'right' });
    yPos += 7;
    if (showDiscount) {
      doc.setFontSize(11);
      doc.setTextColor(22, 163, 74);
      const dLabel = vehicle?.discountType === 'percent'
        ? `Discount (${vehicle?.discountValue}%):`
        : 'Discount:';
      doc.text(dLabel, totalX, yPos);
      doc.text(`-${formatCurrency(totals.laborDiscount)}`, col3X + 2, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 7;
    }
    if (showDeposit) {
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text('Deposit:', totalX, yPos);
      doc.text(`-${formatCurrency(deposit)}`, col3X + 2, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalX, yPos);
    doc.text(formatCurrency(Math.max(0, totals.totalCost - deposit)), col3X + 2, yPos, { align: 'right' });
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalX, yPos);
    doc.text(formatCurrency(totals.totalCost), col3X + 2, yPos, { align: 'right' });
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

async function renderPhotoPages(doc: jsPDF, task: Task): Promise<void> {
  const allPhotos: Array<{ photo: SessionPhoto; sessionNum: number }> = [];
  (task.sessions || []).forEach((session, idx) => {
    (session.photos || []).forEach((photo) => {
      allPhotos.push({ photo, sessionNum: idx + 1 });
    });
  });
  if (allPhotos.length === 0) return;

  // Local IndexedDB-backed photos (mobile capture).
  const filePaths = allPhotos.map((it) => it.photo.filePath).filter((p): p is string => !!p);
  let photoDataMap = new Map<string, string>();
  if (filePaths.length > 0) {
    try {
      photoDataMap = await photoStorageService.loadMultiplePhotos(filePaths);
    } catch (e) {
      console.warn('Failed to load local photos:', e);
    }
  }

  // Pre-mint signed URLs for any cloud-only photos.
  const cloudPaths = Array.from(new Set(
    allPhotos
      .map((it) => it.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(it.photo.cloudUrl))
      .filter((p): p is string => !!p),
  ));
  const cloudSigned = cloudPaths.length ? await photoStorageService.signPhotoUrls(cloudPaths) : {};

  doc.addPage();
  paintBillBackground(doc, 'clean');

  let photoYPos = 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 128);
  doc.text('Work Photos', 105, photoYPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  photoYPos += 15;

  const colWidth = 85;
  const colHeight = 64;
  const colX = [15, 110];
  let colIdx = 0;

  for (const item of allPhotos) {
    if (colIdx === 0 && photoYPos > 200) {
      doc.addPage();
      paintBillBackground(doc, 'clean');
      photoYPos = 20;
    }

    const x = colX[colIdx];
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Session ${item.sessionNum}`, x, photoYPos);

    let photoBase64: string | undefined = item.photo.filePath
      ? photoDataMap.get(item.photo.filePath)
      : item.photo.base64;

    if (!photoBase64) {
      const path = item.photo.cloudPath || photoStorageService.derivePathFromCloudUrl(item.photo.cloudUrl);
      const fetchUrl = (path && cloudSigned[path]) ||
        (item.photo.cloudUrl && !item.photo.cloudUrl.includes('/object/public/') ? item.photo.cloudUrl : undefined);
      if (fetchUrl) {
        try {
          const response = await fetch(fetchUrl);
          const blob = await response.blob();
          photoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Failed to fetch photo from cloud:', e);
        }
      }
    }

    if (photoBase64) {
      try {
        doc.addImage(`data:image/jpeg;base64,${photoBase64}`, 'JPEG', x, photoYPos + 2, colWidth, colHeight);
      } catch (imgError) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('(Image could not be loaded)', x, photoYPos + 15);
      }
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('(Image could not be loaded)', x, photoYPos + 15);
    }

    colIdx++;
    if (colIdx >= 2) {
      colIdx = 0;
      photoYPos += colHeight + 12;
    }
  }
}

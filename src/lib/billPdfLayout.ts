import type jsPDF from 'jspdf';
import billSinglePage from '@/assets/bill_single_page.jpg';
import billFirstPage from '@/assets/bill_first_page.jpg';
import billMiddlePage from '@/assets/bill_middle_page.jpg';
import billLastPage from '@/assets/bill_last_page.jpg';

/**
 * Shared layout constants and helpers for bill / invoice PDFs.
 *
 * Four page-role-specific Letter background templates:
 *   - single : BILL header + flag watermark + "Thank you"
 *              (used when entire bill fits on one page)
 *   - first  : BILL header + flag watermark, no "Thank you"
 *              (page 1 when N > 1)
 *   - middle : Logo only at top, flag at bottom, no BILL, no "Thank you"
 *              (pages 2..N-1, and all photo pages)
 *   - last   : Logo at top, flag + "Thank you" at bottom, no BILL
 *              (page N when N > 1 — carries the TOTAL block)
 */

// US Letter page dimensions (mm).
export const PAGE_W = 215.9;
export const PAGE_H = 279.4;
/** Aliases for callers outside the bill renderer (e.g. DesktopInvoiceView). */
export const LETTER_WIDTH_MM = PAGE_W;
export const LETTER_HEIGHT_MM = PAGE_H;

/** Common horizontal layout anchors used by both renderers (mm). */
export const LEFT_MARGIN_MM = 20;
export const RIGHT_MARGIN_MM = 195.9;
export const PAGE_CENTER_X_MM = PAGE_W / 2;

export type PageRole = 'single' | 'first' | 'middle' | 'last';

const SAFE: Record<PageRole, { top: number; bottom: number }> = {
  single: { top: 66, bottom: 195 },
  first:  { top: 66, bottom: 220 },
  middle: { top: 50, bottom: 230 },
  last:   { top: 50, bottom: 195 },
};

const BACKGROUND: Record<PageRole, string> = {
  single: billSinglePage,
  first:  billFirstPage,
  middle: billMiddlePage,
  last:   billLastPage,
};

export const safeTop = (role: PageRole) => SAFE[role].top;
export const safeBottom = (role: PageRole) => SAFE[role].bottom;

/** Paint the requested page-role background on the *current* page. */
export function paintBillBackground(doc: jsPDF, role: PageRole): void {
  doc.addImage(BACKGROUND[role], 'JPEG', 0, 0, PAGE_W, PAGE_H);
}

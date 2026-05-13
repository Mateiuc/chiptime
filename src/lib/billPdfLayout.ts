import type jsPDF from 'jspdf';
import billBackground from '@/assets/bill-background.jpg';

/**
 * Shared layout constants and helpers for bill PDFs.
 *
 * The bill-background.jpg is 8.5"x11" Letter and contains three decorative
 * zones:
 *   - BILL header + Chip Electric logo  : y =   0 – 40 mm
 *   - Red stars / red rule line         : y =  56 – 60 mm
 *   - Flag watermark (large, faint)     : y = 148 – 245 mm
 *   - "Thank you" calligraphy           : y = 250 – 268 mm
 *
 * Anything below y ≈ 145 mm visually collides with the flag/Thank-you art,
 * so content rendering must stop before that line on a decorative page.
 *
 * Continuation pages mask everything below the header band with a white
 * rectangle, giving us a near-full-page clean writing area.
 */

export const PAGE_W = 215.9;          // mm (Letter width)
export const PAGE_H = 279.4;          // mm (Letter height)

/** Top of the writable content area on every page (just below header band). */
export const CONTENT_TOP = 66;

/** Last allowed y for a content block on a *decorative* page (above flag art). */
export const SAFE_BOTTOM_DECORATIVE = 145;

/** Last allowed y for a content block on a *clean* continuation page. */
export const SAFE_BOTTOM_CLEAN = 268;

/** Y baseline where the TOTAL summary block starts on a decorative page. */
export const TOTAL_BLOCK_Y = 261;

/** Approximate vertical space required for a full TOTAL summary
 *  (subtotal + discount + deposit + total ≈ 4 lines × 7 mm). */
export const TOTAL_BLOCK_MAX_HEIGHT = 32;

export type BgMode = 'decorative' | 'clean';

/**
 * Paint the requested background on the *current* page.
 *
 *  - 'decorative' : full bill-background (header + flag + Thank you)
 *  - 'clean'      : bill-background with everything below the header band
 *                   masked out by a solid white rectangle
 */
export function paintBillBackground(doc: jsPDF, mode: BgMode): void {
  doc.addImage(billBackground, 'JPEG', 0, 0, PAGE_W, PAGE_H);
  if (mode === 'clean') {
    doc.setFillColor(255, 255, 255);
    // Mask from just under the header (covers stars line, flag, "Thank you").
    doc.rect(0, 64, PAGE_W, PAGE_H - 64, 'F');
  }
}

/**
 * Mutable layout cursor used while flowing bill content. Keeps track of the
 * current y position and the background mode of the current page so that
 * page-break decisions can pick the right safe-bottom limit.
 */
export interface BillLayoutCursor {
  doc: jsPDF;
  yPos: number;
  bgMode: BgMode;
  /** Optional callback to redraw column headers on a fresh continuation page. */
  drawContinuationHeader?: (doc: jsPDF) => void;
}

export function safeBottom(mode: BgMode): number {
  return mode === 'decorative' ? SAFE_BOTTOM_DECORATIVE : SAFE_BOTTOM_CLEAN;
}

/**
 * Ensure there is `blockHeight` mm of vertical room on the current page
 * before rendering the next block. If not, open a *clean* continuation page
 * and reset the cursor to the top of its content area.
 *
 * Returns the (possibly updated) y position the caller should render at.
 */
export function ensureRoom(cursor: BillLayoutCursor, blockHeight: number): number {
  if (cursor.yPos + blockHeight <= safeBottom(cursor.bgMode)) {
    return cursor.yPos;
  }
  cursor.doc.addPage();
  paintBillBackground(cursor.doc, 'clean');
  cursor.bgMode = 'clean';
  cursor.yPos = CONTENT_TOP;
  cursor.drawContinuationHeader?.(cursor.doc);
  return cursor.yPos;
}

/**
 * Make sure the TOTAL block lands on a page that has the decorative
 * background. If the current page is clean OR doesn't have enough room above
 * y = TOTAL_BLOCK_Y for the block, append a fresh decorative page.
 *
 * After this call the cursor's bgMode is guaranteed to be 'decorative'.
 */
export function ensureDecorativeFinalPage(cursor: BillLayoutCursor): void {
  const needsNewPage =
    cursor.bgMode !== 'decorative' ||
    cursor.yPos > TOTAL_BLOCK_Y - TOTAL_BLOCK_MAX_HEIGHT;

  if (needsNewPage) {
    cursor.doc.addPage();
    paintBillBackground(cursor.doc, 'decorative');
    cursor.bgMode = 'decorative';
    cursor.yPos = CONTENT_TOP;
  }
}

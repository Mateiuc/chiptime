## Goal

Replace the two-mode (`decorative`/`clean`) bill background system with four page-role-specific JPG templates the user is providing: `bill_single_page.jpg`, `bill_first_page.jpg`, `bill_middle_page.jpg`, `bill_last_page.jpg`. Page roles are decided up-front by simulating the full row layout, so the BILL header appears only on page 1 and "Thank you" only on the final TOTAL page.

## Files touched

- `src/lib/billPdfLayout.ts` — replace `BgMode` with `PageRole`, add per-role safe areas, swap background imports.
- `src/lib/billPdfRenderer.ts` — replace 1-pass-with-fallback flow with full simulation pass that produces a `PageRole[]` sequence, then a draw pass that paints the matching template per page.
- (No edits) `src/components/TaskCard.tsx`, `src/pages/DesktopDashboard.tsx`, `src/services/photoStorageService.ts` — already route through the shared renderer.

Asset folder convention: keep with the existing `src/assets/bill-background.jpg` location → import the four new files from `@/assets/bill_single_page.jpg`, `bill_first_page.jpg`, `bill_middle_page.jpg`, `bill_last_page.jpg`.

## Approach

### 1. Page roles + safe areas (`billPdfLayout.ts`)

```ts
export type PageRole = 'single' | 'first' | 'middle' | 'last';

const SAFE: Record<PageRole, { top: number; bottom: number }> = {
  single: { top: 66, bottom: 195 },
  first:  { top: 66, bottom: 220 },
  middle: { top: 50, bottom: 230 },
  last:   { top: 50, bottom: 195 },
};

export const safeArea = (role: PageRole) => SAFE[role];
export const safeTop = (role: PageRole) => SAFE[role].top;
export const safeBottom = (role: PageRole) => SAFE[role].bottom;
```

`paintBillBackground(doc, role)` swaps in the matching JPG via `addImage`. Drop the white-rectangle masking — each template is already pre-composited.

`BillLayoutCursor.bgMode` becomes `role: PageRole`. `ensureRoom` and `ensureDecorativeFinalPage` are removed; replaced by simulation logic in the renderer (cleaner than mutating cursor mid-flow when role is decided up-front).

After tuning: Lovable will visually verify the `bottom` Y for each template against the actual flag-art top edge in each JPG and adjust if off by >2 mm.

### 2. Two-pass renderer (`billPdfRenderer.ts`)

Keep the existing measure step that builds `MeasuredRow[]` and computes `totalsHeight`. Then:

**Pass A — page-role simulation.**

```text
plan = []                       // array of { role, rows: MeasuredRow[], totalsOnThisPage: bool }
remaining = measured.slice()
// Try single-page fit first
if (startY('single') + sumHeights(remaining) + GAP + totalsHeight <= bottom('single'))
  plan = [{ role: 'single', rows: remaining, totalsOnThisPage: true }]
else
  // Multi-page: assign first → middles → last
  page = { role: 'first', rows: [], totalsOnThisPage: false }
  y = startY('first')
  for each row in remaining:
    if y + row.height > bottom(page.role):
      // orphan rule (from previous plan) — only for clean/middle pages, ≤8mm tolerance
      if (this is the last row AND y + row.height - bottom(page.role) <= 8mm
          AND page.role !== 'first' /* keep first page tidy */):
        // place inline — relax bottom by overflow
      else:
        plan.push(page); page = { role: 'middle', rows: [], ... }; y = startY('middle')
    page.rows.push(row); y += row.height
  // Now decide whether totals fit on the current trailing page when re-typed as 'last'
  if (y + GAP + totalsHeight <= bottom('last')):
    page.role = 'last'; page.totalsOnThisPage = true; plan.push(page)
  else:
    plan.push(page)                                    // close current as 'middle'
    plan.push({ role: 'last', rows: [], totalsOnThisPage: true })
```

Notes:
- Special 2-page case falls out naturally: `['first', 'last']`.
- The trailing page is **renamed** from `middle` → `last` only when totals fit on it. This guarantees the "Thank you" template always carries the TOTAL block.
- Orphan rule applies only to inner page breaks (not the synthetic last-page split for totals).

**Pass B — draw.**

```text
for i, page in enumerate(plan):
  if i > 0: doc.addPage()
  paintBillBackground(doc, page.role)
  if i === 0:
    drawHeaderBlock()                      // Bill to / billed-on / client / vehicle
  drawTableHeader(doc, safeTop(page.role) - 6)   // ALWAYS — every page repeats DESC/TIME/AMOUNT
  cursor.yPos = safeTop(page.role) + 10
  for row in page.rows: drawMeasured(row)
  if page.totalsOnThisPage:
    cursor.yPos += GAP
    drawTotalsBlock(cursor.yPos)           // anchored to current cursor, not pinned Y
```

The "generated at" timestamp goes on the totals page only.

### 3. Photo pages — always `'middle'`

`renderPhotoPages` calls `paintBillBackground(doc, 'middle')` on each new photo page. "Work Photos" title placed at `safeTop('middle')`; grid uses `safeBottom('middle')` for the page-break check. Loader chain, silent failures, and 800px resize from the previous plan stay unchanged.

### 4. Backwards compatibility

Other code paths (mobile share, desktop "Generate Bill") already call the unified `renderBillPdf` — no consumer changes needed. The exported `BgMode` symbol is removed; if any stray import exists it will surface as a TS error and be retyped to `PageRole`.

## Verification

Run `bunx tsc --noEmit`, then regenerate the Mercedes GLS bill (16 sessions + 6 parts + discount + deposit):

- Page 1 = `first` (BILL header, ~9–10 rows, no Thank you).
- Page 2 = `middle` (logo only, ~12 rows including parts).
- Page 3 = `last` (logo top, TOTAL block in safe area, flag + Thank you bottom; Subtotal $5,191 − $591 − $800 = $3,800).
- Page 4 = `middle` (photo grid, if any photos load).
- Smaller bill that fits on one page → `single` template, content vertically inside the safe area.
- Continuation header (DESC/TIME/AMOUNT + red rule) repeats on every page.
- No orphan single-row pages.

## Risks

- Safe-area `bottom` values are estimates; if the simulator places a row that visually crosses the flag art on `first`/`middle`/`last`, tune those numbers after a first visual pass.
- The "rename trailing middle → last" trick assumes `bottom('last') < bottom('middle')`. That holds with the proposed values (195 < 230), so a row that fit in `middle` may not fit in `last` after the rename — handled by the explicit `totals-fit-on-last` recheck which inserts an extra blank `last` page if needed.
- Removing `decorative`/`clean` exports is a breaking API change inside `billPdfLayout.ts`; only `billPdfRenderer.ts` consumes them today, but a quick `rg "BgMode|paintBillBackground|safeBottom"` confirms scope before deleting.

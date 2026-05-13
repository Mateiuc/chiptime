## Bill PDF — polish + column rebalance

**File:** `src/lib/billPdfRenderer.ts` only.

### 1. Trim part description
In the `flowRows.push({ kind: 'part', ... })` loop, normalize the description:
```ts
const condition = (part.description || '').trim();
flowRows.push({
  kind: 'part',
  name: stripDiacritics(part.name),
  description: condition ? stripDiacritics(condition) : null,
  ...
});
```
Fixes `"Alternator (Used )"` → `"Alternator (Used)"`.

### 2. Suppress empty header on totals-only last page
In the page draw loop, gate the header call:
```ts
if (page.rows.length > 0) {
  drawTableHeader(doc, safeTop(page.role));
}
```
On a totals-only `last` page the DESCRIPTION/TIME/AMOUNT band is skipped; totals draw at the same `cursor.yPos = pageStartY(page.role)` baseline as today (the `HEADER_BAND` reservation is preserved, so totals position is unchanged).

### 3. Rebalance columns — wider DESCRIPTION, TIME paired with AMOUNT
Update the layout constants at the top of the file:
```ts
const COL1_X = 20;    // unchanged — DESCRIPTION left edge
const COL2_X = 150;   // was 130 — TIME (now right-aligned, paired with AMOUNT)
const COL3_X = 190.9; // unchanged — AMOUNT right edge
const COL1_WIDTH = COL2_X - COL1_X - 4;  // recomputes to 126mm (was 106mm)
```

**Header** (`drawTableHeader`): right-align TIME at `COL2_X`:
```ts
d.text('TIME', COL2_X, top + 6, { align: 'right' });
d.text('AMOUNT', COL3_X, top + 6, { align: 'right' });
```
DESCRIPTION label stays left-aligned at `25`. Underline `d.line(20, top + 8, 195.9, top + 8)` unchanged.

**Data rows** (`drawMeasured`):
- Session: render `r.time` right-aligned at `COL2_X` instead of `doc.text(r.time, COL2_X + 2, startY)`.
- Part: render `r.quantity` right-aligned at `COL2_X` (keeps quantity visually paired with amount, matches new header).
- AMOUNT rendering at `COL3_X + 2` right-aligned is unchanged in all branches.

**Measure**: `COL1_WIDTH` constant recomputes automatically — `splitTextToSize` for session descriptions now wraps at ~126mm, dropping line counts on long descriptions and pulling content onto fewer pages. No simulator change needed.

### 4. Pagination
No code change. Existing single → first+last → first+middle+last simulator handles preference. Wider DESCRIPTION naturally collapses Mercedes from 3 → 2 pages when possible.

### Out of scope
Session row spacing, part inline-render styling, totals block layout, page-role simulator, safe areas, background templates.

### Verification
1. `bunx tsc --noEmit`.
2. Regenerate Mercedes GLS bill; confirm:
   - "Alternator (Used)" with no trailing space.
   - Long session descriptions wrap to fewer lines.
   - TIME values (e.g. "18:18") right-aligned at 150mm, AMOUNT at 190.9mm — small visible gap, paired.
   - Totals-only last page: no column header band at top.
   - Page count 2 if content fits.

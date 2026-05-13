## Inline part condition with part name

**File:** `src/lib/billPdfRenderer.ts` only.

### 1. Constants (top of file)
- Remove `PART_LABEL_TO_DESC` and `PART_DESC_EXTRA_PAD` (no longer needed).
- Keep `PART_ROW_GAP = 0`.

### 2. `measureRow` — 'part' branch
Replace the description-aware sizing with a uniform row height:
```ts
// part
const height = ROW_LINE_HEIGHT + ROW_VPAD + PART_ROW_GAP; // 8mm
return { row, wrappedDesc: [row.name], wrappedPartDesc: [], height };
```
All parts now measure 8mm whether or not they have a condition. (Wrapping for unusually long combined strings is not measured — matches previous behavior for plain-name parts and is acceptable for the short condition strings in use.)

### 3. `drawMeasured` — 'part' branch
Render name + inline italic gray condition on a single line:
```ts
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
doc.text(r.quantity, COL2_X + 2, startY);
doc.text(r.amount, COL3_X + 2, startY, { align: 'right' });
```
Drop the entire `if (m.wrappedPartDesc.length > 0) { ... }` italic-block branch.

### 4. Untouched
- Sessions, options, totals.
- Page-role simulator (will naturally re-flow Mercedes SRS session back to page 1 if it now fits).

### Verification
- `bunx tsc --noEmit`.
- Regenerate Mercedes GLS bill: confirm "Starter (New)", "Alternator (Used)", etc. on single lines, italic gray condition, quantity/amount aligned, page 2 tightened.

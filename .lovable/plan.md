## Goal
Tighten vertical spacing on part rows in the bill PDF without touching session, option, or totals spacing.

## File
`src/lib/billPdfRenderer.ts` only. No other files touched.

## Current part-row spacing (for reference)

Measure (`measureRow`, `kind: 'part'`):
- `extra = 4 + wrappedPartDesc.length * 5` (4mm gap before italic + 5mm per italic line)
- `height = ROW_LINE_HEIGHT(6) + ROW_VPAD(2) + extra + ROW_GAP(2)`
- With 1 italic line: `6 + 2 + (4 + 5) + 2 = 19mm`
- No description: `6 + 2 + 0 + 2 = 10mm`

Draw:
- Italic block starts at `startY + ROW_LINE_HEIGHT(6)` → 6mm baseline-to-baseline.

## Changes

Introduce two part-specific constants at the top of the layout-constants block (alongside `ROW_LINE_HEIGHT`, `ROW_VPAD`, `ROW_GAP`):

```ts
const PART_LABEL_TO_DESC = 4;   // was implicit ROW_LINE_HEIGHT (6)
const PART_DESC_EXTRA_PAD = 2;  // was 4 (the constant added to lines*5 in measureRow)
const PART_ROW_GAP = 0;         // overrides ROW_GAP(2) for inter-part spacing
```

### `measureRow` — `kind: 'part'` branch
- For parts **with** description: `extra = PART_DESC_EXTRA_PAD + wrappedPartDesc.length * 5` (down from `4 + n*5`), and use `PART_ROW_GAP` instead of `ROW_GAP`.
  - New height (1 italic line): `6 + 2 + (2 + 5) + 0 = 15mm` (was 19mm).
- For parts **without** description: `height = ROW_LINE_HEIGHT + ROW_VPAD + PART_ROW_GAP`.
  - New height: `6 + 2 + 0 = 8mm` (was 10mm).
  - Verifies the user's note: no inherited extra padding.

### `drawMeasured` — `kind: 'part'` branch
- Change italic start from `startY + ROW_LINE_HEIGHT` to `startY + PART_LABEL_TO_DESC` (6mm → 4mm baseline gap).
- Italic line stride stays at 5mm (clear visual grouping preserved).

### Net effect on Mercedes page 2 (3 parts with desc + 3 without)
- Old total: `3*19 + 3*10 = 87mm`
- New total: `3*15 + 3*8 = 69mm` → ~21% reduction (close to target ~25%, well within "feels tighter").

### Untouched (per user)
- Session row measurement/drawing (uses `ROW_LINE_HEIGHT`, `ROW_VPAD`, `ROW_GAP` unchanged).
- Option rows (use `ROW_LINE_HEIGHT + ROW_VPAD + ROW_GAP` unchanged).
- Totals block (`TOTALS_GAP`, internal yPos increments).
- Page-role simulator — it just consumes `m.height`, so the orphan-row / page-fit logic automatically benefits and may pull the trailing SRS session back onto page 1.

## Verification
1. `bunx tsc --noEmit`.
2. Regenerate the Mercedes GLS bill from Desktop dashboard; visually confirm:
   - Page 2 parts block is visibly tighter.
   - Italic sub-description sits ~4mm under its part label, still clearly grouped.
   - No part row crosses into flag/footer art (respects `safeBottom('middle')`).
   - If the simulator now packs the SRS session onto page 1, that's expected.

## Risks
- `PART_ROW_GAP = 0` means consecutive parts touch at the row boundary; visually fine because part rows already have `ROW_VPAD(2)` baked into the height. If the user later wants a bit more breathing room, bump to `1`.
- The smaller italic gap (4mm vs 6mm) is still > the 5mm italic line stride's natural reading rhythm; remains unambiguous.

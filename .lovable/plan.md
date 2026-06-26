## Problem
The live invoice preview in `DesktopInvoiceView.tsx` only renders line items, not Parts. The screenshot shows 4 parts (Front rotors, Rear rotors, Shipping, Tax/Shop) totaling $766 — the total updates correctly, but only the first line item appears in the preview. The generated PDF already renders parts correctly (lines 182–205).

## Fix
In the preview panel (around lines 394–426), after the `activeLineItems.map(...)` block, add a parallel `parts.map(...)` block that mirrors the PDF's parts rendering:

- Continue y-position from where line items ended: `yBase = 78 + activeLineItems.length * 8 + i * 8` (extra spacing when a part has a description, matching the PDF's `yPos += 6` for description).
- For each part with a `name`:
  - Render `part.name` at the description column.
  - If `part.description`, render it on the next line in smaller italic muted text.
  - If `hasAnyTime`, render `part.quantity` in the time column.
  - If `hasAnyAmount`, render `formatCurrency(part.price * part.quantity)` in the amount column.

Use the same `scale`, column offsets, and font sizing already used for line items so the preview stays pixel-aligned with the PDF.

## Scope
- Single file: `src/components/DesktopInvoiceView.tsx`, preview JSX only.
- No changes to PDF generation, state, or totals (already correct).

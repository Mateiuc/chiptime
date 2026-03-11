

# Fix Invoice Layout, Add Description Formatting, Fix Build Error

## Problem
From the generated PDF: client info (name, email, phone, multi-line address) extends down and overlaps the stars decoration band (~y=58-65). The "To:" and date horizontal positioning is correct but client fields need to be more compact to fit above the stars.

Also: user wants bold/italic/underline toggles on description fields.

## Changes

### 1. `src/services/cloudSyncService.ts` — Fix build error
- Line 19-20: Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`

### 2. `src/components/DesktopInvoiceView.tsx` — Layout fixes

**Compact client info to fit above stars (~y=58):**
- PDF: Start client fields at y=46, use +4 spacing (instead of +5), so 4 fields fit in 16mm (y=46 to y=62 max)
- Keep address to single line with truncation in PDF (splitTextToSize with max 1 line width)
- Preview: Mirror same tighter spacing

**Add description formatting (B/I/U):**
- Extend `LineItem` interface: add `bold`, `italic`, `underline` booleans
- Add small toggle buttons (B, I, U) below each description textarea in the form
- PDF: Apply `doc.setFont('helvetica', 'bold'/'italic'/'bolditalic')` per line item; for underline draw `doc.line()` under text
- Preview: Apply CSS `fontWeight`, `fontStyle`, `textDecoration` on description spans

### 3. Files affected
- `src/services/cloudSyncService.ts` (2-line fix)
- `src/components/DesktopInvoiceView.tsx` (layout + formatting)


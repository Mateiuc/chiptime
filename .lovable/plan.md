

# Make Desktop Bill PDF Match Mobile Bill PDF

## Problem
The desktop `generateBillPdf` in `DesktopDashboard.tsx` (line 233) generates a plain-text invoice (no background image, basic "INVOICE" header, simple text layout). The mobile `generateBillingPDF` in `TaskCard.tsx` (line 311) uses the branded background image (`billBackground`), purple "Bill to:" header, styled table with DESCRIPTION/TIME/AMOUNT columns, red separator line, and proper coordinate-based layout matching the template.

## Solution
Replace the desktop `generateBillPdf` function with the same styled PDF generation used in mobile — using the background image, same coordinates, same table layout, same formatting. Also add the missing Add Key and All Keys Lost line items to both mobile and desktop bills.

## Changes

### 1. `src/pages/DesktopDashboard.tsx` — Replace `generateBillPdf` (lines 233-296)
Rewrite to match mobile's `generateBillingPDF`:
- Use `jsPDF({ format: 'letter' })` with `billBackground` image overlay
- Purple "Bill to:" at y=48.5, client name at y=53, vehicle info at y=58.5
- "Billed on" date right-aligned at y=58.5
- Table headers (DESCRIPTION/TIME/AMOUNT) at y=66 with red separator line
- Per-session rows with description, time (hh:mm), and amount
- Billing option line items: Min Hour, Cloning, Programming, **Add Key**, **All Keys Lost**
- Parts section with quantity and price
- TOTAL at y=261
- Timestamp at bottom center
- Import `billBackground` from `@/assets/bill-background.jpg`

### 2. `src/components/TaskCard.tsx` — Add missing Add Key / All Keys Lost lines (after line 423)
Add two blocks after the Programming line item:
```
if (addKeyTot > 0) { doc.text(`Add Key (×${addKeyCnt})`, ...); yPos += 8; }
if (allKeysLostTot > 0) { doc.text(`All Keys Lost (×${allKeysLostCnt})`, ...); yPos += 8; }
```
Need to verify the cost variable names used in TaskCard's scope.

## Files
1. `src/pages/DesktopDashboard.tsx` — rewrite `generateBillPdf`
2. `src/components/TaskCard.tsx` — add Add Key / All Keys Lost line items to billing PDF


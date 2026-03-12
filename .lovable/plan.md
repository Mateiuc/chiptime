

# Fix Invoice Layout & Dynamic Columns

## Issues from the PDF
1. **Invoice number showing** — remove it entirely (no "INV-xxx" on PDF or form)
2. **Client info not aligned with "To:"** — client data should start right after "To:" with a normal gap, and move everything up 5mm
3. **Date too high** — move the date down to sit just above the stars decoration band
4. **TIME/AMOUNT columns showing even when empty** — if a line item only has description (no time, no amount), hide those column headers and let description span full page width

## Changes in `src/components/DesktopInvoiceView.tsx`

### Remove invoice number
- Remove `invoiceNumber` state, remove it from the form, remove it from PDF generation and preview
- Update PDF filename to use `clientName || 'invoice'`

### Fix positions (PDF)
- Move "To:" up to y=43 (was 48)
- Client info starts at y=48 (was 53), +4 spacing — all shifted up 5
- Date: move down to y=55 (right-aligned, just above stars ~y=58)
- Due date below it at y=59

### Dynamic table headers
- Check if ANY active line item has time or amount data
- `hasAnyTime` = any item has time filled
- `hasAnyAmount` = any item has amount > 0
- If neither time nor amount exists across all items: hide TIME and AMOUNT headers, let description wrap full width (col1 extends to ~190mm instead of stopping at 130mm)
- If only one column has data, show only that column header + description

### PDF description width
- When no time/amount columns: `splitTextToSize(description, 170)` instead of `106`
- When time but no amount (or vice versa): adjust width accordingly

### Preview mirror
- Same dynamic logic in the live preview — hide TIME/AMOUNT headers when not needed, extend description width


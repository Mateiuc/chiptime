

# Add Invoice Creator to Desktop Dashboard

## Overview
Add a new `'invoices'` view mode to the desktop dashboard. The user fills a form to create invoices and generates a PDF using the **uploaded Invoice-2.jpg as background** (instead of the old bill-background.jpg), with text positioned at the same coordinates as the existing `generateBillingPDF` in TaskCard.

## Files to Change

### 1. Copy uploaded image to project
- Copy `user-uploads://Invoice-2.jpg` to `src/assets/invoice-background.jpg`

### 2. New: `src/components/DesktopInvoiceView.tsx`
A self-contained component receiving `clients`, `vehicles`, `tasks`, `settings` as props.

**Form fields (left panel):**
- Client selector (dropdown from existing clients, auto-fills name)
- Vehicle selector (filtered by client, auto-fills year/make/model/VIN)
- Date (defaults to today)
- Pre-fill from Task dropdown (optional — picks an existing task and populates line items)
- Dynamic line items: description, time (hh:mm), amount — add/remove rows
- Parts section: name, qty, price, description — add/remove rows
- Billing extras: Min 1 Hour (with count), Cloning (with count), Programming (with count)
- Auto-calculated total

**PDF generation (reusing exact TaskCard positions):**
- `new jsPDF({ format: 'letter' })`
- `doc.addImage(invoiceBackground, 'JPEG', 0, 0, 215.9, 279.4)` — the new uploaded background
- "Bill to:" at (20, 48.5) purple, client name at (20, 53), vehicle at (20, 58.5), date right-aligned at (195.9, 58.5)
- Table headers DESCRIPTION/TIME/AMOUNT at y=72, red line at y=74
- Line items starting at y=82 with 8px spacing
- TOTAL at y=261 right-aligned
- Timestamp at bottom center

**Layout:** Two-column — form on left (~40%), a scaled visual preview of the letter-size page on right (~60%) showing the invoice background with overlaid text matching positions.

### 3. Edit: `src/pages/DesktopDashboard.tsx`
- Change view type: `'tree' | 'settings' | 'reports' | 'invoices'`
- Add `Receipt` icon button (already imported) in header next to reports/settings, toggling `'invoices'` view
- Render `<DesktopInvoiceView>` when `desktopView === 'invoices'`
- Pass `clients`, `vehicles`, `tasks`, `settings` props


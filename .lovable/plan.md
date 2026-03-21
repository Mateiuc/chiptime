

# Use Business Name Instead of Personal Name in Bills

## What changes

When a client has a `companyName` (business name) filled in, use it instead of `client.name` in bill PDFs and the invoice preview. Falls back to `client.name` if no business name exists.

## Files to change

### 1. `src/pages/DesktopDashboard.tsx` (line 279)
Change `client.name || 'N/A'` → `client.companyName || client.name || 'N/A'`

### 2. `src/components/TaskCard.tsx` (line 339)
Change `client?.name || 'N/A'` → `client?.companyName || client?.name || 'N/A'`

### 3. `src/components/TaskCard.tsx` (line 700)
Same change: `client?.companyName || client?.name || 'N/A'`

### 4. `src/components/DesktopInvoiceView.tsx`
In the PDF generation (around the `doc.save` line), change the filename from `clientName` to prefer business name. In the preview panel, also prefer business name display if both fields were to be added — but since the invoice view uses manual entry (not from client DB), no change needed here unless you want to add a "Business Name" field to the invoice form.

**Note**: The invoice creator is a standalone manual-entry tool, so this change primarily affects the bill PDFs generated from tasks (TaskCard and DesktopDashboard).


# Unify Desktop Bill Generation with Shared Renderer

The chart was added to the shared `renderBillPdf()` in `src/lib/billPdfRenderer.ts`, which is used by mobile (`TaskCard.generateBillingPDF`) and `ShareBillDialog`. The **desktop dashboard** still uses its own ~300-line duplicated PDF builder (`DesktopDashboard.generateBillPdf`), so bills generated there are missing the new chart, the improved photo pagination, and any future shared features.

## Fix

Replace `DesktopDashboard.generateBillPdf` body with a thin wrapper that delegates to the shared renderer.

### File: `src/pages/DesktopDashboard.tsx`

Replace lines ~299–615 (`const generateBillPdf = async (task, client, vehicle) => { ... }`) with:

```ts
const generateBillPdf = async (task: Task, client: Client, vehicle: Vehicle) => {
  const doc = await renderBillPdf({ task, client, vehicle, settings });

  // Merge diagnostic PDF if present (preserve existing desktop behavior).
  if (task.diagnosticPdfUrl || task.diagnosticPdfPath) {
    try {
      const freshUrl = await resolveDiagnosticPdfUrl({
        path: task.diagnosticPdfPath,
        url: task.diagnosticPdfUrl,
      });
      if (freshUrl) {
        const billBlob = doc.output('blob');
        const merged = await mergePdfs(billBlob, freshUrl);
        const url = URL.createObjectURL(merged);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${stripDiacritics(client.name)}-${vehicle.vin}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Bill PDF Generated', description: 'Includes diagnostic report' });
        return;
      }
    } catch (e) {
      console.warn('Failed to merge diagnostic PDF, saving without it:', e);
    }
  }

  doc.save(`invoice-${stripDiacritics(client.name)}-${vehicle.vin}.pdf`);
  toast({ title: 'Bill PDF Generated' });
};
```

### Imports

Add `import { renderBillPdf } from '@/lib/billPdfRenderer';` and remove now-unused imports (`jsPDF`, `billBackground`, `applyLaborDiscount`, `formatCurrency`, `photoStorageService` — verify each is still used elsewhere in the file before deleting).

## Result

- Desktop "Generate Bill", "Preview Bill", and "Generate & Mark Billed" all go through the shared renderer.
- The "Time Worked per Day" chart now appears on desktop bills, including re-generations for `billed`/`paid` tasks.
- Bonus: desktop and mobile bills become visually identical (4-role page backgrounds, proper totals anchoring, robust photo loading).

## Out of Scope

- No changes to `DesktopInvoiceView` (separate accounting invoice flow with its own layout).
- No changes to the shared renderer itself.

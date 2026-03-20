

# Fix Desktop Bill Photos, Diacritics, and Add Diagnostic PDF Upload

## Problems
1. **Desktop bill PDF missing photos**: Mobile `TaskCard.tsx` appends session photos to the bill (lines 503-597), but desktop `generateBillPdf` in `DesktopDashboard.tsx` stops after the total — no photo pages.
2. **Diacritics not rendering**: jsPDF's built-in `helvetica` font lacks extended Latin characters (é, ñ, ü, etc.). Characters with diacritics render as blank or garbled. Fix: strip diacritics from text before rendering (jsPDF limitation — no custom font embedding without significant overhead).
3. **Diagnostic PDF per vehicle**: New feature — allow uploading a diagnostic PDF per vehicle, store it in cloud storage, and append its pages to the end of both mobile and desktop bill PDFs.

## Changes

### 1. `src/types/index.ts` — Add `diagnosticPdfUrl` to Vehicle
Add `diagnosticPdfUrl?: string` to the `Vehicle` interface for storing the cloud URL of the uploaded diagnostic PDF.

### 2. Create utility: `src/lib/pdfUtils.ts`
- `stripDiacritics(text: string)`: uses `String.normalize('NFD').replace(...)` to remove accent marks
- Shared helper for both mobile and desktop PDF generation

### 3. `src/pages/DesktopDashboard.tsx` — Fix bill PDF
- Import `stripDiacritics` and wrap all user-facing text (client name, descriptions, part names) through it
- Add photo pages after the total section (port the logic from TaskCard lines 503-597, using `cloudUrl` fetch since desktop has no local filesystem)
- Add diagnostic PDF pages: after photos, if `vehicle.diagnosticPdfUrl` exists, fetch the PDF bytes via `pdf-lib`, extract pages, and append them using jsPDF's `addPage` + image rendering (convert PDF pages to images via canvas)
- Add "Upload Diagnostic PDF" button per vehicle row in the tree view

### 4. `src/components/TaskCard.tsx` — Fix mobile bill PDF
- Import `stripDiacritics` and apply to all text in `generateBillingPDF`
- After the photos section, if `vehicle.diagnosticPdfUrl` exists, fetch and append diagnostic PDF pages
- Add "Upload Diagnostic" button in the vehicle/task UI

### 5. Diagnostic PDF upload flow
- Upload handler: accepts a PDF file input, converts to base64, calls the existing `upload-photo` edge function pattern (or a new `upload-diagnostic` edge function) to store in a `diagnostic-pdfs` storage bucket
- On success, save the public URL to `vehicle.diagnosticPdfUrl` via `updateVehicle`

### 6. Storage bucket migration — `diagnostic-pdfs`
Create a new public storage bucket `diagnostic-pdfs` for storing uploaded diagnostic PDFs.

### 7. Edge function: `supabase/functions/upload-diagnostic/index.ts`
Similar to `upload-photo` — accepts base64 PDF + vehicleId, uploads to `diagnostic-pdfs` bucket, returns public URL.

### 8. Appending diagnostic PDF to bill
Since jsPDF can't natively merge existing PDFs, use `pdf-lib` (already available or add as dependency) to:
- Generate the bill as a PDF blob from jsPDF
- Load the diagnostic PDF from URL
- Merge them using `pdf-lib`'s `PDFDocument.load` + `copyPages`
- Output the final merged PDF

## Files to create/edit
1. `src/types/index.ts` — add `diagnosticPdfUrl` to Vehicle
2. `src/lib/pdfUtils.ts` — new file with `stripDiacritics`
3. `src/pages/DesktopDashboard.tsx` — diacritics fix, add photos, add diagnostic PDF merge, add upload button
4. `src/components/TaskCard.tsx` — diacritics fix, add diagnostic PDF merge, add upload button
5. `supabase/functions/upload-diagnostic/index.ts` — new edge function
6. SQL migration — create `diagnostic-pdfs` storage bucket
7. `package.json` — add `pdf-lib` dependency


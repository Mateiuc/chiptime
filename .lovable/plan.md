## PDF generation audit — read-only

### Entry points found

| # | File : function | Triggered by | Lives on | Scope | Status tabs | Branded bill? | Shared renderer? | Phase fix applied? |
|---|---|---|---|---|---|---|---|---|
| 1 | `src/components/TaskCard.tsx` : `generateBillingPDF` | Dropdown "Bill" + "Generate Bill & Mark Billed" handler (`handleGenerateBill`) | Mobile TaskCard | Single task / vehicle | Completed → Billed (`billed`) | Yes (bill-background) | Renderer A — mobile/share | **Yes** — uses `billPdfLayout` (paintBillBackground, ensureRoom, ensureDecorativeFinalPage) |
| 2 | `src/components/TaskCard.tsx` : `generatePreviewPDF` | Dropdown "Preview Bill" | Mobile TaskCard | Single task | Completed | Yes | Renderer A (duplicated) | **Yes** |
| 3 | `src/components/TaskCard.tsx` : `generateDetailPDF` | Dropdown "Print detail" | Mobile TaskCard | Single task | Billed / Paid | No (plain) | Renderer B — plain detail | N/A (no background) |
| 4 | **`src/pages/DesktopDashboard.tsx` : `generateBillPdf`** | Desktop "Generate Bill & Mark Billed" (`handleGenerateBillAndMarkBilled` L652) and desktop "Preview Bill" (`handlePreviewBill` L661); also re-billing from billed/paid rows on desktop | Desktop dashboard rows | Single task / vehicle | Completed / Billed / Paid (any desktop bill action) | Yes (bill-background) | Renderer C — desktop bill (independent copy) | **NO** — calls `doc.addImage(billBackground, ...)` once at L324, uses fixed `yPos = 261` for totals (L456), `doc.addPage()` for photos at L517 with no `paintBillBackground('clean')`, no `ensureRoom`, no safe-area logic. Photo fetch falls back to "(Photo on device only)" text at L579. |
| 5 | `src/pages/DesktopDashboard.tsx` : `generateClientPDF` (L928) | "Print PDF" on a client | Desktop client cards | Client aggregate report | All | No (plain) | Renderer D — client report | N/A |
| 6 | `src/components/DesktopClientsView.tsx` (L143 `new jsPDF()`) | Client report button on desktop clients view | Desktop clients view | Client aggregate | All | No | Renderer D-variant | N/A |
| 7 | `src/components/ManageClientsDialog.tsx` : `generateClientPDF` (L202) | "Print PDF" in Manage Clients dialog | Mobile manage-clients | Client aggregate | All | No | Renderer D-variant | N/A |
| 8 | `src/components/DesktopInvoiceView.tsx` : `generatePDF` | "Generate PDF" button in standalone invoice creator | Desktop Invoice view | Manual invoice | N/A | Yes (separate `invoice-background.jpg`) | Renderer E — invoice creator | N/A (different artwork; not affected by bill issues) |
| — | `src/components/TaskCard.tsx` L1155 | Error-fallback only | — | — | — | — | not used | — |

### Distinct *bill/invoice* rendering paths

Three branded paths exist:
- **Renderer A** — TaskCard.generateBillingPDF + generatePreviewPDF (mobile). Phase 6/PDF fix applied.
- **Renderer C** — DesktopDashboard.generateBillPdf. **Not patched.**
- **Renderer E** — DesktopInvoiceView (manual invoice, different background, different problem domain).

### Why the Valy Ilasca / Mercedes GLS bill is still broken

The user re-generated the bill from the **desktop UI**, which routes through `handleGenerateBillAndMarkBilled` / `handlePreviewBill` → `DesktopDashboard.generateBillPdf` (Renderer C). The Phase fix only touched `TaskCard.tsx` (Renderer A). That is why:
- Parts/totals still collide — Renderer C uses a hard-coded `yPos = 261` for the TOTAL block (L456-490) regardless of how many rows have been laid out above it.
- "(Photo on device only)" placeholders still appear — Renderer C tries `cloudPath/cloudUrl → signed URL → fetch → base64`. The mobile renderer uses the same logic but its photo records carry richer fallbacks at this point, and Renderer C never falls back to the local IndexedDB photo cache the mobile path uses.
- "Thank you" still appears mid-content — the photos page is added with `doc.addPage()` (L517) but the bill background isn't reapplied; jsPDF leaves a blank page, so on multi-photo runs the totals/photo content visually overlaps the decorative footer of page 1 (and the second bill page also lacks the white mask the new `paintBillBackground('clean')` provides).

### Recommendation — Option A (consolidate)

Strongly preferred. Create one shared renderer module (e.g. `src/lib/billPdfRenderer.ts`) that:
- Takes `(task, client, vehicle, settings, opts)` and returns a `jsPDF` document (or a Blob).
- Uses the existing `billPdfLayout` helpers (`paintBillBackground`, `ensureRoom`, `ensureDecorativeFinalPage`) end-to-end.
- Houses the photo-embedding logic (with the IndexedDB → cloud → signed-URL fallback chain) in one place.
- Houses the totals/discount/deposit block in one place so future billing-math changes (Phase 1/6) only have to land once.

Then:
- Replace `TaskCard.generateBillingPDF` / `generatePreviewPDF` with thin wrappers that call the shared renderer (mobile only adds the share/save plumbing around it).
- Replace `DesktopDashboard.generateBillPdf` with a thin wrapper that calls the same shared renderer and then performs the desktop save / diagnostic-merge step.
- Leave Renderer B (detail), D (client report) and E (manual invoice) alone — they're different products.

Outcome: one place for layout, photos, totals, and any future bill changes; the Valy Ilasca regression disappears the moment desktop switches over.

### Option B (only if A is too risky to land in one go)

Port the Phase fix into `DesktopDashboard.generateBillPdf` directly:
1. Replace the single `doc.addImage(billBackground, ...)` with `paintBillBackground(doc, 'decorative')`.
2. Build a `BillLayoutCursor` and route all row writes through `ensureRoom(...)` so parts/options can flow to a clean continuation page.
3. Call `ensureDecorativeFinalPage(cursor)` before drawing the TOTAL block (drop the hard-coded `yPos = 261`).
4. Before the photos page, call `paintBillBackground(doc, 'clean')` after `doc.addPage()` (and on every photo overflow page).
5. Add the IndexedDB-photo fallback (mirror the mobile logic) so missing-cloud photos no longer print the "(Photo on device only)" placeholder when a local copy exists.

Then file a follow-up task to consolidate (Option A).

### Deliverable for next step

Tell me **A** or **B** and I'll implement. I'd recommend A — the desktop and mobile renderers will keep diverging otherwise, and Phase 6's billing-math work has the same shape (one shared module).



# Fix Client Portal: Diagnostic PDF, Photo Lightbox, Payment Link

## Issues to Fix

1. **Diagnostic PDF not visible in portal** — The portal data model (`SessionCostDetail`, `SlimSession`) does not carry `diagnosticPdfUrl`. Need to thread it through the slim encoding and display a "View Diagnostic Report" link/button per task in the portal.

2. **Photos not browsable full-screen one-by-one** — The current lightbox opens one photo but has no prev/next arrows. Need to add navigation so the client can swipe/click through all session photos.

3. **Payment link for client** — Add a settings field for the mechanic to enter a Zelle/Cash App payment link (or both). Display a "Pay Now" button in the portal that opens the link.

## Changes

### 1. Thread Diagnostic PDF Through Portal Data

**`src/lib/clientPortalUtils.ts`**
- Add `diagnosticPdfUrl?: string` to `SessionCostDetail` interface
- Add `dpdf?: string` to `SlimSession` interface
- In `calculateClientCosts`: populate `diagnosticPdfUrl` from `task.diagnosticPdfUrl` on each session
- In `slimDown`: map `diagnosticPdfUrl` to `dpdf`
- In `inflateSlimPayload`: map `dpdf` back to `diagnosticPdfUrl`
- In `generatePortalHtmlFile`: render a "📄 View Diagnostic Report" link when `ss.dpdf` exists

**`src/components/ClientCostBreakdown.tsx`**
- After the photo gallery in each session, if `session.diagnosticPdfUrl` exists, show a button/link: "📄 View Diagnostic Report" that opens the PDF URL in a new tab

### 2. Full-Screen Photo Navigation (Prev/Next)

**`src/components/ClientCostBreakdown.tsx`**
- Replace the single-image `Dialog` lightbox with a navigable one
- Track `lightboxIndex` and the current photo array
- Add left/right arrow buttons (ChevronLeft, ChevronRight) and keyboard support
- Show "X of Y" counter
- Same improvement in the HTML file (`generatePortalHtmlFile`) — add a simple JS lightbox overlay with prev/next

### 3. Payment Link in Settings + Portal

**`src/types/index.ts`**
- Add `paymentLink?: string` and `paymentLabel?: string` (e.g. "Zelle", "Cash App") to `Settings` interface

**`src/components/DesktopSettingsView.tsx` + `src/components/SettingsDialog.tsx`** (mobile)
- Add input fields for "Payment Link URL" and "Payment Label" in settings

**`src/lib/clientPortalUtils.ts`**
- Add `paymentLink?: string` and `paymentLabel?: string` to `ClientCostSummary`
- Thread through slim encoding (`pl`, `plbl` fields)
- Pass from `calculateClientCosts` or `syncPortalToCloud` params
- Render in HTML file as a button

**`src/components/ClientCostBreakdown.tsx`**
- If `costSummary.paymentLink` exists, show a prominent "Pay Now" button at the bottom that opens the URL

**`src/pages/ClientPortal.tsx`**
- Pass payment link through to `ClientCostBreakdown`

### 4. Update `syncPortalToCloud` and call sites
- Add `paymentLink` and `paymentLabel` as optional params
- Pass from settings at all call sites

## Files to Edit
1. `src/types/index.ts` — add payment fields to Settings
2. `src/lib/clientPortalUtils.ts` — diagnostic PDF + payment link in data model, slim encoding, HTML file
3. `src/components/ClientCostBreakdown.tsx` — diagnostic PDF link, photo lightbox navigation, pay button
4. `src/pages/ClientPortal.tsx` — pass payment data
5. `src/components/DesktopSettingsView.tsx` — payment link settings UI
6. `src/components/SettingsDialog.tsx` — payment link settings UI (mobile)


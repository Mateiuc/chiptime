## Goal

Fix six layout regressions in `src/lib/billPdfRenderer.ts` while keeping the decorative bill template (BILL header, flag watermark, "Thank you"). Decorative art appears only on the page that contains the TOTAL block; all other pages (continuation + photos) use the clean header-only background.

## Files touched

- `src/lib/billPdfLayout.ts` — add measure helper + tighten `ensureDecorativeFinalPage`.
- `src/lib/billPdfRenderer.ts` — rewrite row-flow + photo-page logic.
- (Investigation only, no edits) `src/components/TaskCard.tsx`, `src/pages/DesktopDashboard.tsx`, `src/services/photoStorageService.ts`.

## Approach

### 1. Two-pass render to choose page-1 background (Bug 1)

Today page 1 is painted `decorative` unconditionally, capping the safe area at y≈145mm (~5 rows fit) and forcing an early break.

- Add a measure pass: walk sessions/options/parts with the same wrap math used for drawing (`splitTextToSize` against `col1Width = col2X - col1X - 4`), compute each block's height, sum + add the totals block height.
- If everything fits on a single decorative page → paint page 1 `decorative`.
- Otherwise → paint page 1 `clean` so page 1 gets the full ~268mm safe area (~9–10 rows). The TOTAL block then lands on a fresh decorative page via `ensureDecorativeFinalPage`.

### 2. Single shared row renderer with proper wrap (Bugs 2 + 6)

- Extract `drawRow(label, time, amount)` that wraps `label` to `col1Width`, computes `rowHeight = max(8, lines * 6 + 2)`, calls `ensureRoom(cursor, rowHeight)` first (so a row never straddles a page), draws label wrapped, TIME at `col2X`, AMOUNT right-aligned at `col3X`, all top-aligned, then advances `cursor.yPos` by `rowHeight`.
- Continuation header (already wired via `cursor.drawContinuationHeader`) reuses `drawTableHeader` so font/columns are identical on every page.
- Apply `drawRow` to sessions, option rows, and part rows. Parts keep their italic gray sub-description with the same wrap width.

### 3. Greedy packing, orphan-row prevention, totals fit-on-current-page (Bug 3)

Two distinct rules, both run after greedy packing.

**3a. Orphan-row prevention (always runs, before totals).**
After packing each row, before opening a new page for the next row N:

```
if N is the LAST remaining row
   AND previousPage.yPosBeforeBreak + rowHeight(N) <= safeBottom(prevMode) + 8mm
then place N on the previous page (relax safe area by up to 8mm)
else open new clean page as usual
```

Never leave exactly one row alone on a content page. Implemented by a small lookahead in the row-flow loop: instead of calling `ensureRoom` directly per row, the loop tracks `remaining` count and, when `remaining === 1` and the next row would overflow by ≤8mm, draws it inline anyway. This is independent of the totals rule.

**3b. Totals fit-on-current-page.**
- Compute `totalsHeight = 7 + (showDiscount?7:0) + (showDeposit?8:0) + 9` (≤31mm).
- New `ensureDecorativeFinalPage(cursor, totalsHeight)`:
  - If `cursor.bgMode === 'decorative'` AND `cursor.yPos + totalsHeight <= SAFE_BOTTOM_DECORATIVE` → keep current page; draw totals at `cursor.yPos`.
  - Else open a fresh decorative page; draw totals at `TOTAL_BLOCK_Y - 7*extraLines` as today.

### 4. Photo pages — clean background + safe top offset (Bug 4)

- First photo page already calls `paintBillBackground(doc, 'clean')`. Bug: `photoYPos` starts at 20mm, under the BILL header (header band ends ~64mm).
- Start "Work Photos" centered title at `CONTENT_TOP` (66mm), then advance to `CONTENT_TOP + 12`.
- New-page trigger: switch when `photoYPos + colHeight + captionHeight > SAFE_BOTTOM_CLEAN`.
- Two-column grid; `colHeight` ~75mm; 12mm vertical row gap.

### 5. Photo loading investigation + multi-source loader (Bug 5)

**Storage map (from code trace):**

| Source | Set by | Reachable from |
|---|---|---|
| `filePath` (Capacitor Filesystem on native, IndexedDB store `photo-storage-db` on web) | `TaskCard` → `photoStorageService.savePhoto` at capture | Same device only |
| `cloudPath` + `cloudUrl` (Supabase private `session-photos` bucket; signed URL ~1h) | `uploadPhotoToCloud` async after capture | Any device, requires `sign-photo-urls` edge fn |
| Legacy `base64` | Pre-migration only | Embedded in task |

Why the desktop bill currently shows "(Image could not be loaded)": task captured on phone → `filePath` resolves to a mobile path the desktop browser's IndexedDB doesn't have, AND `signPhotoUrls` either failed silently or `cloudPath` is missing on older photos. The renderer attempts the chain but logs only.

**Fix in `renderPhotoPages`:**

1. Per-photo loader chain, in order: `base64` → local map → batched signed URL → public `cloudUrl` → on-demand single-path `signPhotoUrls` retry.
2. Resize loaded image client-side (canvas) to longest side 800px, JPEG quality 0.75 before `addImage`.
3. Track `{ ok, failed }` counts.
4. **Omit failures silently** — drop the "(Image could not be loaded)" placeholder. If `ok === 0`, skip the entire photo section (don't even call `addPage`); move the early bail to after the loader pass.
5. Return `{ photosOk, photosFailed }` from `renderBillPdf` so callers can toast a quiet "N photos couldn't be loaded" notice.

### 6. Verification

Regenerate the Mercedes GLS bill (16 sessions + 6 parts + discount + deposit). Expected:

- Page 1: clean background, header band only, ~9–10 session rows.
- Page 2: same fonts/columns, header repeated, remaining sessions + option rows + parts (~12 rows).
- Page 3: decorative background, only the TOTAL block (Subtotal $5,191 − Discount $591 − Deposit $800 = TOTAL $3,800).
- No orphan single-row pages anywhere.
- Photo pages (if any photo loadable): clean background, "Work Photos" title at safe top, two-column grid with no header overlap.
- Photo failures silent; section omitted if all fail.

`bunx tsc --noEmit` clean. Test the desktop "Generate Bill & Mark Billed" path (now routes through the same renderer).

## Risks

- Measure pass must mirror draw math exactly or page-1 background choice will be wrong → share a single `wrapAndMeasure(label)` helper used by both passes.
- 8mm orphan-tolerance can push a row slightly into the flag art on a decorative page; orphan rule applies only on `clean` pages (the only place rows live in multi-page bills).
- `ensureDecorativeFinalPage` change affects single-page bills; verify a 2-row bill still gets the full decorative background.
- Photo resize creates an `Image` + `<canvas>` per photo; fine for ~10 photos.

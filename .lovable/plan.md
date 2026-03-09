

# Fix Invoice Text: Position & Labels

## Changes
Three adjustments in `src/components/DesktopInvoiceView.tsx`:

1. **Move "Bill to:" and "Billed on" text higher** — reduce y-coordinates so they sit closer to the header area (currently at y=48.5 and y=58.5, move both up ~6-8mm)
2. **Change "Bill to:" → "To:"** in both the PDF generation and the live preview
3. **Change "Billed on {date}" → just the date string** (e.g. "3/8/2026") in both PDF and preview

### Affected lines in `DesktopInvoiceView.tsx`:

**PDF generation (~lines 132-140):**
- Line 136: `'Bill to:'` → `'To:'`, y from `48.5` → `~42`
- Line 140: `Billed on ${billedDate}` → just `${billedDate}`, y from `58.5` → `~42`
- Shift client name (line 146) and vehicle info (line 149) up accordingly

**Live preview (~lines 404-418):**
- Line 406: `Bill to:` → `To:`, top from `44` → `~38`
- Line 418: `Billed on ...` → just the date, top from `55` → `~38`
- Shift client name and vehicle preview positions up to match


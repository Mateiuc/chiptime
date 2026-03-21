

# Fix: High Severity Dependency Vulnerabilities

## Problem
Two dependencies have known high-severity vulnerabilities:
- **xlsx (SheetJS) ^0.18.5** — Prototype Pollution + ReDoS
- **vite-plugin-pwa ^1.2.0** — outdated

## Solution

### 1. Replace `xlsx` with `@zurmokeeper/exceljs`
The `xlsx` package is no longer maintained on npm and has unpatched vulnerabilities. Replace it with `@zurmokeeper/exceljs` (an actively maintained fork of ExcelJS, compatible API, MIT license).

Only one file uses `xlsx`: `src/lib/xlsImporter.ts`.

**Changes to `package.json`:**
- Remove `xlsx`
- Add `@zurmokeeper/exceljs`

**Rewrite `src/lib/xlsImporter.ts`:**
- Replace `import * as XLSX from 'xlsx'` with ExcelJS imports
- Use `new ExcelJS.Workbook()` + `workbook.xlsx.load(arrayBuffer)` to read the file
- Iterate rows using ExcelJS's `worksheet.eachRow()` API
- Adapt date/time parsing: ExcelJS returns JS Date objects for date-formatted cells, so `parseExcelDate` and `combineDateTime` need minor adjustments
- Keep all exported types and the `parseWorkHistoryXls` function signature identical so no consumer code changes are needed

### 2. Update `vite-plugin-pwa`
- Update `vite-plugin-pwa` from `^1.2.0` to latest (`^1.2.1` or newer) to pick up dependency patches
- No code changes needed — the config in `vite.config.ts` is compatible

## Files to Change
1. `package.json` — swap `xlsx` for `@zurmokeeper/exceljs`, bump `vite-plugin-pwa`
2. `src/lib/xlsImporter.ts` — rewrite to use ExcelJS API (same exports, same behavior)


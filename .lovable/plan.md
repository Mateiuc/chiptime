

# Fix XLS Import — Three Bugs

## Identified Issues

### Bug 1: Headerless files return empty
`1row.xls` has no header row. The parser does `if (raw.length < 2) return []` and treats row 0 as headers. With only 1 data row, it returns nothing.

### Bug 2: Breaks description parsing broken by comma split
`parseBreaksDescription` splits on commas, which destroys full-date breaks like `"November 18, 2022, 17:02 – November 19, 2022, 00:57"` into unusable fragments. This is why breaks are ignored and only one period is created.

### Bug 3: Description shows raw Excel number
The description field shows `0.4756944444444444` (which is `11:25:00` as an Excel fractional day). This likely comes from a headerless file where column indices are wrong, or from Excel returning a number for what appears to be text.

## Changes — `src/lib/xlsImporter.ts`

### 1. Add headerless fallback
After reading `raw[0]`, check if header detection finds the required columns. If not, assume standard column order `(0=Date, 1=Start, 2=End, 3=Duration, 4=rel.Duration, 5=Description, 6=Tags, 7=Breaks, 8=BreaksDesc)` and set data start to row 0 instead of 1. Also remove the `raw.length < 2` early return (a single-row headerless file is valid).

### 2. Fix breaks description splitting
Change `parseBreaksDescription` to split on `<br\s*\/?>` and `\n` only — **not comma**. Then trim trailing/leading commas and whitespace from each segment. This preserves full date strings like `"November 18, 2022, 17:02 – November 19, 2022, 00:57"` while still handling multi-break formats like `"23:12 – 23:58 ,<br/>01:49 – 03:24"`.

### 3. Force description to string
Already done with `.toString()`, but add a guard: if the value is a number and looks like an Excel fractional day (0-1 range), skip it and use empty string. This prevents Duration/rel.Duration numbers from leaking into description when columns are misaligned.


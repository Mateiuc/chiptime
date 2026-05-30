# Add Daily Time Worked Chart to Bill PDF

Append a final page to every bill PDF that visualizes how much time was worked on the task per calendar day, aggregated across all sessions and periods.

## Where

`src/lib/billPdfRenderer.ts` — `renderBillPdf()`. New page added after photo pages, before returning the doc.

## Data

Iterate `task.sessions[].periods[]`:
- Bucket by `startTime` calendar date (local time, YYYY-MM-DD key).
- Sum `period.duration` (seconds) per day.
- Sort chronologically.
- If only one or zero days have data, still render the chart (single bar is fine); skip the page only if zero periods exist.

## Layout

- New page using the existing `middle` background (logo top, flag bottom — consistent with photo pages).
- Title: "Time Worked per Day" in purple (matches "Work Photos" styling), centered at `safeTop('middle')`.
- Chart area below the title, within `safeTop('middle') + 14` to `safeBottom('middle') - 20`, full width inside `LEFT_MARGIN_MM`..`RIGHT_MARGIN_MM`.
- Vertical bar chart:
  - X-axis = days (date label `DD/MM` under each bar, rotated −45° if >8 days to avoid overlap).
  - Y-axis = hours worked. Y scale = max day rounded up to next 0.5h. Draw 4 horizontal gridlines with hour labels on the left.
  - Bars: rounded-top rectangles in the brand purple (`128,0,128`) with a thin black border; bar width auto-fit, gap = 30% of slot.
  - Value label above each bar: `Hh Mm` (e.g. `2h 15m`) in 8pt bold.
- Footer summary line under chart: `Total: Xh Ym across N day(s)` centered.

## Technical Details

- Add helper `renderDailyTimeChart(doc, task)` near `renderPhotoPages`. Returns early when no periods exist.
- Use jsPDF primitives only (`rect`, `line`, `text`, `setFillColor`, `setDrawColor`). No new deps.
- Use existing `formatDurationHHMM` for tooltips/labels, plus a small `formatHm(seconds)` helper for `Xh Ym` style.
- Call `await renderDailyTimeChart(doc, task)` immediately after `await renderPhotoPages(doc, task)` in `renderBillPdf`.
- All text passed through `stripDiacritics` is unnecessary here (numeric/date labels only).

## Out of Scope

- No changes to `DesktopInvoiceView` (separate accounting invoice flow).
- No changes to totals math or photo rendering.
- No external chart library.

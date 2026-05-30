# Stacked Period Segments in Daily Time Chart

Update the bar chart added to the bill PDF so that each day's bar is subdivided into colored segments — one segment per period that ran that day, sized proportionally to that period's share of the day's total.

## Where

`src/lib/billPdfRenderer.ts` → `renderDailyTimeChart()`.

## Data change

Replace the current `Map<string, { date, seconds }>` with:

```ts
Map<string, { date: Date; periods: { seconds: number }[] }>
```

For each `period` in each session, push `{ seconds: period.duration }` into the bucket for its `startTime` calendar day. Skip periods with `duration <= 0`. Sort the periods within each day by their original start time so segment order is chronological.

## Rendering change

For each day bar:
- Compute `daySeconds = sum(periods.seconds)`.
- Compute the bar's full height `bh` from `daySeconds / maxHours` (same scale as today).
- Iterate periods bottom-up. For each period:
  - `segH = (period.seconds / daySeconds) * bh`
  - Fill with a color from a fixed palette indexed by the period's global index (so the same period gets the same color even across days). Cycle the palette if there are more periods than colors.
  - Draw `doc.rect(bx, segY, barW, segH, 'F')` (fill only).
  - Draw a thin white separator line between segments (`setDrawColor(255,255,255)`, `setLineWidth(0.3)`) except at the top.
- After all segments, draw a single black outline around the full bar (`doc.rect(bx, by, barW, bh, 'S')`).
- Keep the existing total label (`formatHm(daySeconds)`) above the bar.

## Color palette

Add a local constant:

```ts
const PERIOD_COLORS: [number, number, number][] = [
  [128, 0, 128],   // brand purple
  [37, 99, 235],   // blue
  [22, 163, 74],   // green
  [234, 88, 12],   // orange
  [220, 38, 38],   // red
  [202, 138, 4],   // amber
  [13, 148, 136],  // teal
  [219, 39, 119],  // pink
];
```

Indexed by **global period index** (counter incremented as we walk sessions/periods in order), modulo palette length, so the same period keeps its color even if days are reordered.

## Legend

Skip a legend — the value label above each bar already shows the day's total, and adding a legend per period would not fit when there are many periods. Segments are visually distinct enough without one.

## Out of scope

- No change to data aggregation logic outside the chart.
- No change to non-chart pages.
- No new dependency.

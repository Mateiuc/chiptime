# Stick the two daily bars together

## Change
In `src/components/DesktopReportsView.tsx`, the "Time worked per day" `<BarChart>` (~line 615), add `barCategoryGap={0}` (and `barGap={0}` for safety) so the per-day vehicle stack and period stack render with no gap between them.

```tsx
<BarChart
  data={vehicleDaily.data}
  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
  barCategoryGap={0}
  barGap={0}
>
```

No other changes.

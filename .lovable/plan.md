## Resize per-day period chart in Reports

In `src/components/DesktopReportsView.tsx`, the per-day stacked period chart (shown when drilling into a vehicle) currently uses a dynamic height that grows with the number of days, which makes it look tall/narrow. Change it to match the "Revenue Over Time" chart's footprint: full width, fixed 380px tall, days spread left-to-right.

### Change

Replace the height wrapper at line 570:

```tsx
<div style={{ height: Math.min(360, Math.max(180, vehicleDaily.data.length * 28 + 80)) }}>
```

with:

```tsx
<div className="h-[380px]">
```

Also add a small `margin={{ top: 10, right: 10, left: 10, bottom: 5 }}` on the `<BarChart>` to mirror the Revenue Over Time chart spacing.

### Out of scope

- Keep vertical bar orientation (days on X axis, time on Y axis) — same as Revenue Over Time.
- No changes to colors, data, tooltip, or stacking logic.
- No changes to other charts.

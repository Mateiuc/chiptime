

# Add Session Work Periods to Client Portal

## What to build

Show each session's work period start/stop times in the client portal. Round duration seconds (≥30s rounds up to next minute, <30s rounds down). Remove seconds from all date/time displays.

## Data flow changes

Currently `SessionCostDetail` only stores `date` and `duration` — no period start/stop times. Need to thread period times through the entire pipeline:

### 1. `src/lib/clientPortalUtils.ts` — Add periods to data model

**SessionCostDetail interface** (line 6): Add new field:
```typescript
periods: { start: Date; end: Date }[];
```

**SlimSession interface** (line 58): Add compact periods field:
```typescript
pds?: [number, number][]; // [startTimestamp, endTimestamp][]
```

**calculateClientCosts** (line 183): Pass periods from session:
```typescript
periods: session.periods.map(p => ({ start: p.startTime, end: p.endTime })),
```

**slimDown** (line 253): Encode periods:
```typescript
pds: s.periods.length > 0 ? s.periods.map(p => [Math.floor(new Date(p.start).getTime()/1000), Math.floor(new Date(p.end).getTime()/1000)]) : undefined,
```

**inflateSlimPayload** (line 305): Decode periods:
```typescript
periods: (ss.pds || []).map(([s, e]) => ({ start: new Date(s*1000), end: new Date(e*1000) })),
```

### 2. `src/components/ClientCostBreakdown.tsx` — Display periods

- Add a helper to format time without seconds: `HH:MM AM/PM`
- Round displayed duration: `formatDuration` → show as `Xh Ym` (no seconds), rounding total seconds to nearest minute
- Under each session header, show period rows like:
  ```
  Start: 10:30 AM → Stop: 11:45 AM
  ```
  For multiple periods, show each on its own line

### 3. `src/lib/clientPortalUtils.ts` — HTML portal generator

Update the `renderContent` JS in the self-contained HTML:
- `fmtDur`: round to minutes, show `Xh Ym` (already does this)
- Add `fmtTime(ts)` helper for `HH:MM AM/PM`
- Render period start/stop under each session

### 4. Duration rounding logic

```typescript
// Round seconds: ≥30 → round up minute, <30 → round down
const totalMinutes = Math.round(session.duration / 60);
const hours = Math.floor(totalMinutes / 60);
const mins = totalMinutes % 60;
// Display: "1h 23m" or "0h 45m"
```

## Files to change

1. **`src/lib/clientPortalUtils.ts`** — Add `periods` to interfaces, calculateClientCosts, slimDown, inflateSlimPayload, and HTML generator
2. **`src/components/ClientCostBreakdown.tsx`** — Display period start/stop times, round duration display, remove seconds from dates


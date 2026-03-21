

# Color-Code Start (Green) and Stop (Red) Times Everywhere

## Changes

### 1. `src/components/ClientCostBreakdown.tsx` (line 290)
Currently: `🕐 {formatTimeOnly(period.start)} → {formatTimeOnly(period.end)}`

Change to render start time in green and end time in red:
```tsx
<span className="text-green-500 font-medium">{formatTimeOnly(period.start)}</span>
<span className="text-muted-foreground"> → </span>
<span className="text-red-500 font-medium">{formatTimeOnly(period.end)}</span>
```

### 2. `src/components/EditTaskDialog.tsx` (lines 472-473, 505-506)
- "Start" label: change `text-muted-foreground` to `text-green-600` (both desktop span and mobile Label)
- "End" label: change `text-muted-foreground` to `text-red-600` (both desktop span and mobile Label)

### 3. `src/components/TaskInlineEditor.tsx` (lines 328, 342)
- "Start" span: change `text-muted-foreground` to `text-green-600`
- "End" span: change `text-muted-foreground` to `text-red-600`

### 4. `src/lib/clientPortalUtils.ts` (line 525) — HTML portal generator
Update the inline JS that renders periods to wrap start time in green and end time in red using inline CSS styles:
```js
h+='<div class="extra-line"><span style="color:#22c55e;font-weight:600">'+fmtTime(pd[0])+'</span> → <span style="color:#ef4444;font-weight:600">'+fmtTime(pd[1])+'</span></div>'
```

## Summary
4 files, purely cosmetic color changes to Start/Stop time labels and values. Green = start, Red = stop, consistent across the entire app.


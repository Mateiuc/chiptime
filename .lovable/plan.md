## Goal
Surface the per-session **Extra Charge** amount in the desktop session editors so it can be viewed and edited after the session was completed — mirroring what the mobile Complete Work dialog already writes.

## Where
1. **`src/components/TaskInlineEditor.tsx`** — session row (~line 281–315 icon strip).
2. **`src/components/EditTaskDialog.tsx`** — both session-row layouts (~line 620–660 compact, ~line 900–940 expanded).

## UI
Right after the `KeyRound` (All Keys Lost) icon toggle, add a compact inline input:

```
[$ ____]
```

- ~72–88px wide, `h-7` (compact) or `h-8` (expanded) to match neighboring toggles.
- Local string state per session to allow blank/typing; commit on blur (`onBlur`) into the session with `extraCharge = parseFloat(value) || undefined` (undefined when empty/0, matching the mobile write path).
- Same `setSessions(prev => prev.map(s => s.id === session.id ? { ...s, extraCharge: ... } : s))` pattern already used for the toggles.
- Tooltip / `title="Extra charge"` for clarity, no visible caption.

## Not changing
- Billing math (already handled in `computeSessionLaborDetails`).
- Mobile `CompleteWorkDialog` (already has the field).
- Types (already extended in prior step).
- Save flow — these editors already persist the whole `sessions` array back through the existing save handlers, so `extraCharge` rides along automatically.

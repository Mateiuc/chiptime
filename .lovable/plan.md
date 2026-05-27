## Root cause

The Lamborghini task's $80 labor comes from the **session-level** `chargeMinimumHour` flag (set during the mobile "Complete Work" flow), not from the period-level one.

DB confirms:
- `period.chargeMinimumHour = false` (the pill the user toggles)
- `session.chargeMinimumHour = true` (no UI to turn off on desktop)
- duration = 1s, parts = $500 → labor $80 + parts $500 = **$580**

`TaskInlineEditor` (desktop inline edit) only exposes a **per-period** Min 1hr pill. The session-level flag has no toggle on desktop, so the user can't turn it off and the total never drops to $500. `EditTaskDialog` (mobile) already has a session-level Flag button — desktop is the only surface missing it.

## Fix

Add a session-level "Min 1hr" Flag icon button to `TaskInlineEditor`'s session header, alongside the existing Cloning / Programming / Add Key / All Keys Lost icons (lines 262-302). Same pattern as `EditTaskDialog.tsx:891`:

```tsx
<Button
  variant="ghost" size="icon"
  className={`h-7 w-7 ${session.chargeMinimumHour ? 'text-primary' : 'text-muted-foreground/40'}`}
  onClick={() => setSessions(prev => prev.map(s =>
    s.id === session.id ? { ...s, chargeMinimumHour: !s.chargeMinimumHour } : s))}
  title="Charge minimum 1 hour for this session"
  aria-label="Charge minimum 1 hour for this session"
>
  <Flag className="h-3.5 w-3.5" fill={session.chargeMinimumHour ? 'currentColor' : 'none'} />
</Button>
```

Place it right before the Cloning button (so order is: Min1hr · Cloning · Programming · AddKey · AllKeysLost · Delete).

## Out of scope

- No billing math changes (`computeSessionLaborDetails` already handles both flags correctly; period flag wins).
- No change to the per-period pill (still useful when only one period needs the bump).
- No data migration.

## Verification

1. Open Lamborghini billed task on desktop → expand session → click new Flag icon to turn off session Min 1hr → Save Changes.
2. Header should drop from `$580` to `$500` immediately after save.
3. Toggle back on → header returns to `$580`.
4. Run `bunx tsc -p tsconfig.app.json --noEmit` and `bunx vitest run` (38 tests) — should remain green (no logic touched).

## Files

- `src/components/TaskInlineEditor.tsx` — add one Button in the session header row.



# Add "Charge Minimum 1 Hour" Toggle to Inline Task Editor

## What changes

Add a Switch toggle for `chargeMinimumHour` in the footer area of `TaskInlineEditor.tsx`, so when editing a task inline on desktop, the user can enable/disable the minimum 1-hour billing — same option available in CompleteWorkDialog.

## Files

### Edit: `src/components/TaskInlineEditor.tsx`
- Import `Switch` from `@/components/ui/switch`
- Add state: `const [chargeMinimumHour, setChargeMinimumHour] = useState(task.chargeMinimumHour || false)`
- In the footer area (before the Save/Cancel buttons), add a row with a Switch + label "Charge minimum 1 hour"
- In `handleSave`, include `chargeMinimumHour` in the saved task: `onSave({ ...task, sessions: validSessions, totalTime, chargeMinimumHour })`

### Layout
```text
Footer area:
[Delete Car]     [⬜ Charge min 1hr]  [+ Add Session] [Cancel] [Save]
```


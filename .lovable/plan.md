

# Add "Min 1hr" Toggle to EditTaskDialog

The `EditTaskDialog.tsx` (used from `TaskCard` on both mobile and desktop) is missing the `chargeMinimumHour` toggle. The `TaskInlineEditor` already has it, but `EditTaskDialog` does not.

## Changes — `src/components/EditTaskDialog.tsx`

1. **Import `Switch`** from `@/components/ui/switch`
2. **Add state**: `const [chargeMinimumHour, setChargeMinimumHour] = useState(task.chargeMinimumHour || false)` (after existing state declarations, ~line 43)
3. **Update `handleSave`** (~line 452): include `chargeMinimumHour` in the saved task object
4. **Add Switch to `renderFooter`** (~line 578): insert a Switch + label "Min 1hr" inside the `!showDeleteConfirm` block, before the Add Session button

### Footer layout after change:
```text
[Delete Car]  [⬜ Min 1hr]  [Add Session]  [Cancel]  [Save Changes]
```

Single file edit: `src/components/EditTaskDialog.tsx`


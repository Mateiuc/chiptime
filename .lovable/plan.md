

# Merge Billing Options into "More Work Needed" Card in CompleteWorkDialog

## What changes

Combine the 3 billing toggles (Min 1 Hour, Cloning, Programming) into the same card as "More work needed on this vehicle?" — instead of a separate card. All 4 switches live in one card, with a subtle divider between the follow-up toggle and the billing options.

## Changes — `src/components/CompleteWorkDialog.tsx`

### 1. Add state + update signature
- Add `chargeMinimumHour`, `isCloning`, `isProgramming` boolean states (default false)
- Update `onComplete` signature: `(description, parts, needsFollowUp, chargeMinimumHour, isCloning, isProgramming)`
- Pass all flags in `handleComplete`, reset them on complete
- Import `Flag, Copy, Cpu` from lucide-react

### 2. Merge into the "More work needed" card (lines 94-109)
Replace the single-toggle card with a card containing 4 rows with a separator:

```
┌─ Session Options ──────────────────────┐
│  More work needed?           [on/off]  │
│  ─────────────────────────────────────  │
│  🚩 Min 1 Hour               [on/off]  │
│  📋 Cloning                   [on/off]  │
│  💻 Programming               [on/off]  │
└────────────────────────────────────────┘
```

### 3. Update `src/pages/Index.tsx`
- Update `handleCompleteWork` to accept the 3 new flags and apply them to the completed session

### 4. Types already have the fields
`WorkSession` already has `chargeMinimumHour` and `isCloning`. Need to add `isProgramming` to types, plus `programmingRate` to `Client` and `defaultProgrammingRate` to `Settings`.

### 5. Add Programming icon to EditTaskDialog & TaskInlineEditor session headers
Third icon button (`Cpu`) next to Flag and Copy, toggles `session.isProgramming`.

### 6. Add Programming Rate inputs
- `AddClientDialog.tsx` — programmingRate field
- `ManageClientsDialog.tsx` — programmingRate in edit form
- `SettingsDialog.tsx` — defaultProgrammingRate input
- `DesktopSettingsView.tsx` — defaultProgrammingRate input

### 7. Billing calculations (6 files)
Add `if (session.isProgramming && programmingRate > 0) sessionCost += programmingRate;` alongside existing cloning logic in: `TaskCard.tsx`, `DesktopDashboard.tsx`, `DesktopClientsView.tsx`, `ManageClientsDialog.tsx`, `SettingsDialog.tsx`, `clientPortalUtils.ts`

### Files to edit
- `src/types/index.ts`
- `src/components/CompleteWorkDialog.tsx`
- `src/pages/Index.tsx`
- `src/components/EditTaskDialog.tsx`
- `src/components/TaskInlineEditor.tsx`
- `src/components/SettingsDialog.tsx`
- `src/components/DesktopSettingsView.tsx`
- `src/components/AddClientDialog.tsx`
- `src/components/ManageClientsDialog.tsx`
- `src/components/TaskCard.tsx`
- `src/pages/DesktopDashboard.tsx`
- `src/components/DesktopClientsView.tsx`
- `src/lib/clientPortalUtils.ts`




# Fix: Task Cost Not Updating After Edit

## Problem Found

The `getTaskCost` helper function (used to display prices on vehicle cards and task rows) has a bug on lines 665-666:

```typescript
// BUG: Missing client-level rate lookups
const addKeyRate = settings.defaultAddKeyRate || 0;           // ← ignores client.addKeyRate
const allKeysLostRate = settings.defaultAllKeysLostRate || 0; // ← ignores client.allKeysLostRate
```

Meanwhile, the bill PDF generator (line 241-242) correctly uses:
```typescript
const addKeyRate = client.addKeyRate || settings.defaultAddKeyRate || 0;           // ✓
const allKeysLostRate = client.allKeysLostRate || settings.defaultAllKeysLostRate || 0; // ✓
```

This means:
- The **displayed price** in the tree view uses only the global default rates (which may be 0)
- The **bill PDF** correctly picks up client-specific rates
- After editing a task, the price shown doesn't match the bill because `getTaskCost` calculates a different (wrong) amount

## Fix

**File: `src/pages/DesktopDashboard.tsx`** — Update lines 665-666 in the `getTaskCost` function:

```typescript
const addKeyRate = client?.addKeyRate || settings.defaultAddKeyRate || 0;
const allKeysLostRate = client?.allKeysLostRate || settings.defaultAllKeysLostRate || 0;
```

This is a 2-line fix that aligns the display calculation with the bill PDF calculation.


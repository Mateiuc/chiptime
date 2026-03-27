

# Add Clipboard Copy for VIN Everywhere

## Problem
VIN displays across the app are plain text — clicking them does nothing. The user wants the same "click to copy" behavior as the PIN buttons.

## UI VIN Display Locations (5 spots)

| # | File | Line | Context |
|---|------|------|---------|
| 1 | `TaskCard.tsx` | 1304 | Mobile task card header |
| 2 | `DesktopClientsView.tsx` | 359 | Client detail vehicle card |
| 3 | `ManageClientsDialog.tsx` | 803-804 | Manage clients vehicle list |
| 4 | `DesktopDashboard.tsx` | 1485 | Sidebar vehicle header |
| 5 | `ClientCostBreakdown.tsx` | 243-244 | Cost breakdown vehicle section |

## Changes

All 5 spots get the same treatment — wrap the VIN text in a clickable element with `cursor-pointer` that copies to clipboard and shows a "VIN Copied!" toast.

**Pattern applied everywhere:**
```tsx
<p className="text-xs text-muted-foreground font-mono mt-1 cursor-pointer hover:text-foreground transition-colors"
   onClick={() => {
     navigator.clipboard.writeText(vehicle.vin);
     toast({ title: 'VIN Copied!', description: vehicle.vin });
   }}
   title="Click to copy VIN"
>
  VIN: {vehicle.vin}
</p>
```

### Files modified
- `src/components/TaskCard.tsx` — line 1304
- `src/components/DesktopClientsView.tsx` — line 359
- `src/components/ManageClientsDialog.tsx` — lines 803-805
- `src/pages/DesktopDashboard.tsx` — line 1485
- `src/components/ClientCostBreakdown.tsx` — lines 242-246


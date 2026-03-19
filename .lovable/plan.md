

# Fix "Add Key" and "All Keys Lost" — Missing Integration Points

## Summary
The Add Key and All Keys Lost flags were added to session completion, editing, and some desktop cost calculations, but are missing from several critical areas: bill PDF line items, client portal data pipeline, portal UI display, ManageClientsDialog costs, TaskInlineEditor toggles, and the desktop tree view return values.

## Gaps Found (7 areas)

### 1. Bill PDF — Missing line items (`src/pages/DesktopDashboard.tsx` ~line 274)
Add Key and All Keys Lost totals are calculated but never printed on the PDF. After the Programming line, add:
```
if (addKeyTot > 0) { y += 7; doc.text(`Add Key (×${addKeyCnt}): ...`) }
if (allKeysLostTot > 0) { y += 7; doc.text(`All Keys Lost (×${allKeysLostCnt}): ...`) }
```

### 2. Client Portal cost calculation (`src/lib/clientPortalUtils.ts`)
- `SessionCostDetail` interface: add `addKeyCost` and `allKeysLostCost` fields
- `VehicleCostSummary` / `ClientCostSummary`: add `totalAddKey` and `totalAllKeysLost`
- `calculateClientCosts()`: compute and include addKey/allKeysLost costs in labor
- `SlimSession` / `SlimVehicle` / `SlimPayload`: add `akc` and `aklc` wire fields
- `slimDown()` / `inflateSlimPayload()`: serialize and deserialize the new fields

### 3. Client Portal UI (`src/components/ClientCostBreakdown.tsx`)
- Session detail: show 🔑 Add Key and 🗝️ All Keys Lost line items (lines ~196-201)
- Vehicle subtotal: show Add Key / All Keys Lost rows (lines ~260-271)
- Grand total: show Add Key / All Keys Lost rows (lines ~307-317)
- Filter recalculation: include addKeyCost/allKeysLostCost in totals (lines ~90-93)

### 4. ManageClientsDialog costs (`src/components/ManageClientsDialog.tsx`)
- Both `getClientFinancials` (~line 131) and `getVehicleFinancials` (~line 167): add addKeyRate/allKeysLostRate lookups and include in cost calculations

### 5. TaskInlineEditor toggles (`src/components/TaskInlineEditor.tsx` ~line 289)
- Add Key and All Keys Lost toggle buttons are missing after the Programming button. Add them using `Key` and `KeyRound` icons.

### 6. Desktop `getClientFinancials` / `getVehicleFinancials` return values
- `getClientFinancials` (~line 523) returns `totalCloning, totalProgramming` but not `totalAddKey, totalAllKeysLost`
- `getVehicleFinancials` (~line 567) same issue — calculates them but doesn't return them

### 7. `calculateClientCosts` function signature (`src/lib/clientPortalUtils.ts` ~line 98)
- Currently only accepts `defaultCloningRate`. Needs `defaultProgrammingRate`, `defaultAddKeyRate`, and `defaultAllKeysLostRate` parameters too (programming rate currently falls back to `client.programmingRate || 0` ignoring the global default).

## Files to Edit
1. `src/pages/DesktopDashboard.tsx` — bill PDF lines + return values
2. `src/lib/clientPortalUtils.ts` — types, calculation, slim encoding/decoding
3. `src/components/ClientCostBreakdown.tsx` — portal UI display
4. `src/components/ManageClientsDialog.tsx` — cost calculations
5. `src/components/TaskInlineEditor.tsx` — toggle buttons


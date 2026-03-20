

# Add Per-Client "Add Key" and "All Keys Lost" Rates

## Summary
The `Client` type is missing `addKeyRate` and `allKeysLostRate` fields. These need to be added to the type and to all client forms (add + edit on both mobile and desktop), plus the cost calculation lookups need to use client-level rates before falling back to global defaults.

## Changes

### 1. `src/types/index.ts` — Add fields to Client interface
Add `addKeyRate?: number` and `allKeysLostRate?: number` to the `Client` interface (after `programmingRate`).

### 2. `src/components/AddClientDialog.tsx` — Add Key / All Keys Lost inputs
- Add `addKeyRate` and `allKeysLostRate` state variables
- Include them in `onSave` call
- Add two new input fields after Programming Rate
- Reset on save

### 3. `src/components/ManageClientsDialog.tsx` — Mobile edit form + cost lookups
- **Edit form** (~line 536-565): Add two new rate input fields after Programming Rate
- **handleStartEdit** (~line 362): Include `addKeyRate` and `allKeysLostRate` in `editFormData`
- **getClientFinancials** (~line 123): Change `addKeyRate` lookup from `settings.defaultAddKeyRate || 0` to `client?.addKeyRate || settings.defaultAddKeyRate || 0`
- **getVehicleFinancials** (~line 166): Same change

### 4. `src/components/DesktopClientsView.tsx` — Desktop edit form
- **handleStartEdit** (~line 109): Add `addKeyRate` and `allKeysLostRate` to the form data
- **Edit form grid** (~line 247-252): Add two new input fields for the rates

### 5. Cost calculation fixes across the app
Update all locations that currently use only `settings.defaultAddKeyRate` to first check `client.addKeyRate`:
- `src/pages/DesktopDashboard.tsx` — all cost calculation blocks
- `src/lib/clientPortalUtils.ts` — `calculateClientCosts` function

## Files to edit
1. `src/types/index.ts`
2. `src/components/AddClientDialog.tsx`
3. `src/components/ManageClientsDialog.tsx`
4. `src/components/DesktopClientsView.tsx`
5. `src/pages/DesktopDashboard.tsx`
6. `src/lib/clientPortalUtils.ts`


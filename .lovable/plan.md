## Goal
Allow scheduling a car without a VIN, and provide a fast "Scan VIN" action on schedule entries to fill/update the vehicle's VIN later (when the car is physically present).

## Changes

### 1. Make VIN optional when adding a vehicle from Schedule
File: `src/components/ScheduleEntryDialog.tsx`
- Remove the "Missing VIN" toast block in `handleSaveNewVehicle`.
- Allow saving with empty VIN (store empty string or a placeholder like `PENDING-<shortId>` so dedupe still works — empty string preferred so UI shows "no VIN yet").
- Skip the "Duplicate VIN" check when VIN is empty.
- Enable the "Save vehicle" button even with empty VIN (only require at least Make or Model OR allow fully empty? — require at least one of: VIN / Make / Model so the row is identifiable).
- Update VIN input placeholder to "VIN (optional — can scan later)".

### 2. Show VIN status and quick-scan on schedule cards
File: `src/components/ScheduleView.tsx`
- Next to the vehicle line, show either the VIN (small mono) or a yellow "No VIN" chip.
- Add a small **Scan VIN** icon button (camera icon) on each entry card. Visible always; highlighted (pulsing/amber) when the linked vehicle has no VIN.
- Clicking it opens `VinScanner`. On detect:
  - Update the vehicle's `vin` via a new `onUpdateVehicle(vehicleId, { vin })` prop.
  - Also re-decode (NHTSA) to fill in missing make/model/year if those are empty.
  - Toast "VIN saved".
- Block scan if the new VIN duplicates an existing active task's VIN.

### 3. Wire `onUpdateVehicle` through callers
Files: `src/pages/Index.tsx`, `src/pages/DesktopDashboard.tsx`
- Pass an `updateVehicle(id, patch)` handler into `<ScheduleView />` (mobile and desktop). Reuse existing vehicle update logic already used by `EditVehicleDialog`.

### 4. Propagate VIN to the started Task (if scanned later)
File: `src/components/ScheduleView.tsx` — `handleStart`
- Already reads `vehicle.vin` at start time, so once VIN is saved on the vehicle, starting the task picks it up automatically. No change needed beyond ensuring vehicle is re-read fresh at click time.

## Out of scope
- No changes to the standalone `AddVehicleDialog` / `AddVehiclePage` flows (those keep their current VIN rules).
- No backend schema changes — `vehicle.vin` already accepts any string.

## Technical notes
- Empty VIN handling: treat `vin === ''` as "pending". `validateVin` is only called when user provides one.
- The Scan VIN button on a card reuses the existing `VinScanner` component and `decodeVin` from `vinDecoder.ts`.

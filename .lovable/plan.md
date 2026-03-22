

# Add Prepaid Amount Tracking to Vehicles

## What it does
- Add a `prepaidAmount` field to vehicles, editable when editing a vehicle
- Show prepaid (red) and remaining balance next to vehicle cost in the dashboard header
- Add a "Prepaid" / "Remaining" line in the bill PDF, subtracted from total

## Changes

### 1. Vehicle type — `src/types/index.ts`
Add `prepaidAmount?: number` to the `Vehicle` interface

### 2. Desktop inline vehicle edit — `src/pages/DesktopDashboard.tsx`
- Add `prepaidAmount` to `vehicleEditData` state type (line 117)
- Add "Prepaid $" input in inline edit form (after Color input, ~line 1464)
- Include `prepaidAmount` in save handler (line 1476-1482)
- Populate when entering edit mode (line 1434)

### 3. Vehicle header display — `src/pages/DesktopDashboard.tsx` (~line 1426-1428)
After the green total cost, if `vehicle.prepaidAmount > 0`:
- Show prepaid in red: `Prepaid: $500.00`
- Show remaining in orange: `Remaining: $3,213.53`
- If fully paid (prepaid >= cost), show "Paid" in green

### 4. Bill PDF — `src/pages/DesktopDashboard.tsx` (~line 391-396)
After parts and before TOTAL line, if `vehicle.prepaidAmount > 0`:
- Add line: "Prepaid" with negative amount in red
- Change TOTAL to show `total - prepaidAmount` (or $0 if overpaid)
- Keep original total visible as "Subtotal" before the prepaid line

### 5. Mobile edit dialog — `src/components/EditVehicleDialog.tsx`
- Add `prepaidAmount` state, input field, include in save


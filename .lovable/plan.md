

# Inline Vehicle Editing in Desktop Tree View

## Change

Replace the `EditVehicleDialog` usage with inline expand editing directly inside the vehicle card — same pattern as the existing inline client editing.

### `src/pages/DesktopDashboard.tsx`

1. **Add state**: `editingVehicleId: string | null` and `editVehicleFormData` (vin, make, model, year, color) — replaces `editingVehicle`
2. **Remove** `EditVehicleDialog` import and its render block (lines 810-830)
3. **Vehicle header edit button**: Instead of `setEditingVehicle(vehicle)`, set `editingVehicleId = vehicle.id` and populate form data
4. **Inline form**: Below the vehicle header, when `editingVehicleId === vehicle.id`, render a horizontal row of inputs:
   - VIN (w-56), Make (w-40), Model (w-40), Year (w-24), Color (w-32) — all on one line with Save/Cancel buttons
   - Standard desktop-sized inputs, not stretched
5. **Save handler**: Validates VIN (17 chars, no duplicates), calls `updateVehicle`, clears editing state
6. **Cancel**: Clears `editingVehicleId`

### Files changed
- `src/pages/DesktopDashboard.tsx` — replace dialog with inline editing


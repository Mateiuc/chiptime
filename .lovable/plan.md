# Let VIN be edited freely

Today the vehicle editors refuse to save any VIN that is not exactly 17 characters. That means a legacy vehicle with a short VIN like `0000` can never be corrected to another short value, and you cannot type a partial VIN and save it for later.

## Change

VIN becomes editable to any value:

- Only rule left: VIN cannot be empty, and cannot duplicate another vehicle's VIN.
- If the saved VIN is not 17 characters, it still saves — you just get a short "Saved (VIN is not 17 characters)" notice instead of a blocking error.
- All tasks attached to the vehicle keep their VIN in sync when it changes (already the behaviour, unchanged).

Applies in both places:

- Desktop dashboard inline vehicle edit row
- Mobile Edit Vehicle screen

## Technical notes

- `src/pages/DesktopDashboard.tsx` (inline vehicle save, ~lines 1730-1748): drop the `vinChanged && length !== 17` blocking check; keep the empty check and run the duplicate check whenever the VIN changed. Replace the hard error with an informational toast when length !== 17. Remove `maxLength={17}` from the VIN input so longer text can be typed.
- `src/components/EditVehicleDialog.tsx` (`handleSave`, lines 82-89): same change — remove the 17-character rejection, keep empty and duplicate checks, remove the input's `maxLength`.
- Add Vehicle flows keep their strict 17-character validation, since new entries should be correct VINs.

## Add Discount input next to Deposit — desktop inline vehicle editor

Vehicle Deposit appears as an editable input in two places only:
1. **`EditVehicleDialog.tsx`** (mobile) — Discount is already here, next to Deposit. ✅
2. **`src/pages/DesktopDashboard.tsx`** — desktop inline row (VIN / Make / Model / Year / Color / Deposit / Save). ❌ Discount missing.

The other "Deposit" inputs (`DesktopClientsView.tsx:281`, `DesktopDashboard.tsx:1629`, `ManageClientsDialog.tsx:610`) belong to the **Client** record, not the Vehicle. Since discount is a per-vehicle field, it does not apply there.

So this plan adds the Discount input to the one remaining place.

### Changes — `src/pages/DesktopDashboard.tsx`

1. Extend `vehicleEditData` (line 141) with:
   - `discountType: 'fixed' | 'percent'`
   - `discountValue: string`
2. When opening the editor (line 1686), seed those from `vehicle.discountType` / `vehicle.discountValue`.
3. After the Deposit input (line 1717), add a compact `$ | %` toggle plus a numeric Input for the discount value (max 100 when percent).
4. In Save (lines 1729–1736), parse + clamp the value (same logic as `EditVehicleDialog`) and set `discountType` / `discountValue` on the `updates` payload, or `undefined` when blank/0.

No other files change. All math, PDFs, reports, and the client portal already consume `applyLaborDiscount`, so they pick up the new value automatically.

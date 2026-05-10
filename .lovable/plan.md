## Remove discount field from Add Vehicle screens

The Labor Discount input was added to **Add Vehicle** flows by mistake. Vehicles should be created with just the basics; discount is configured later in **Edit Vehicle** (where it already sits next to Deposit, which you confirmed is good).

### Changes
1. **`src/components/AddVehicleDialog.tsx`** — remove the `discountType` / `discountValue` state, the segmented `$ | %` input block, and any `discountType`/`discountValue` props sent on save.
2. **`src/components/AddVehiclePage.tsx`** — same cleanup as above.
3. **No change** to `EditVehicleDialog.tsx` — discount stays there beside Deposit.
4. **No change** to data model, math, TaskCard, reports, or PDFs — discount logic continues to work for any vehicle that has the values set via Edit Vehicle.

### Out of scope
- Session-level discount/deposit (not doing this).
- Touching deposit anywhere (it stays exactly where it is).

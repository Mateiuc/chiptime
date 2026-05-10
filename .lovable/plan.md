## Remove Deposit field from Add Vehicle screens

The **Deposit ($)** input must not appear when adding a new vehicle. It stays only on **Edit Vehicle** (alongside the discount).

### Changes
1. **`src/components/AddVehicleDialog.tsx`** — remove `prepaidAmount` state, the Deposit input block, the `setPrepaidAmount('')` reset, and the `prepaidAmount` field on the `onSave` payload.
2. **`src/components/AddVehiclePage.tsx`** — same cleanup (state, reset, the `<F label="Deposit ($)">` input, and the `prepaidAmount` on `onSave`).
3. **No change** to `EditVehicleDialog.tsx` — Deposit and Discount stay there.
4. **No change** to data model or any totals — vehicles created without a deposit simply have `prepaidAmount = undefined`; existing vehicles keep their deposit and the rest of the app works unchanged.

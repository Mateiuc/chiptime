# Why the 17-character VIN won't save

## What's actually happening

The save is being blocked by the duplicate-VIN check, not by the length rule.

Checking the live data for this workspace, the same client (Lance Naidoo) already has three placeholder vehicles:

- `0000` — Lamborghini Urus (the one you are editing)
- `00000000000000` — BMW M5
- `00000000000000000` — BMW (no model) — **exactly the 17 zeros you are typing**

So when you type 17 zeros into the Urus and press Save Changes, the editor finds another vehicle already using that VIN and refuses. The dialog does show a "This VIN already exists" toast, but on desktop it appears at the far edge and is easy to miss.

## Proposed fix

1. Make the block obvious: when the save is refused because of a duplicate, show the message inline under the VIN field (red text naming the conflicting vehicle, e.g. "Already used by BMW"), in addition to the toast. Same for the length rule.
2. Clean up the duplicate placeholder: the empty BMW with 17 zeros looks like leftover junk. Options — you pick:
   - delete that BMW record so the Urus can take the 17-zero VIN, or
   - give the Urus a different unique placeholder VIN.
3. Optionally relax placeholder collisions: keep enforcing uniqueness for real VINs, but allow repeated all-zero placeholders so junk data never blocks an edit.

## Technical notes

- `src/components/EditVehicleDialog.tsx` — duplicate check at the VIN comparison; add inline error state next to the VIN input and surface the conflicting vehicle's make/model.
- `src/pages/DesktopDashboard.tsx` (inline vehicle editor, ~line 1742) — same duplicate check; apply the same inline messaging.
- If option 3 is chosen, skip the duplicate check when the VIN matches `^0+$`.
- Deleting the stray BMW vehicle is a data change to the workspace sync record; only done on your confirmation.

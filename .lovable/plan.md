## Problem

On Samsung phones the label-based picker in `src/lib/cameraSelect.ts` still selects the ultra-wide lens. Android Chrome labels are inconsistent (often generic like `camera2 0, facing back` or localized strings), so matching on words like `wide`/`main`/`ultra` is unreliable. We need a detection method that does not depend on label text, plus a manual override so the user can always force the correct lens.

## Solution

Two changes that work together:

### 1. Probe-based lens detection (no labels)

Replace the label heuristic in `src/lib/cameraSelect.ts` with a capability probe:

- Enumerate `videoinput` devices, keep those with `facingMode: 'environment'` (or label hints when present, as a fallback).
- For each rear candidate, briefly open a stream with `getUserMedia({ video: { deviceId: { exact } } })`, read `track.getCapabilities()` and `track.getSettings()`, then stop the stream.
- Score each lens:
  - **Ultra-wide signal** → `capabilities.zoom?.min < 1` (typically 0.5) **or** very wide reported FOV. Reject.
  - **Telephoto signal** → `capabilities.zoom?.min > 1` (e.g. 3.0) or label contains `tele`. Reject for default.
  - **Main signal** → `zoom.min === 1` (or no zoom capability) and not flagged as depth/mono/IR. Prefer.
- Cache the winning `deviceId` per session in `sessionStorage` so we don't probe every capture.
- Expose a new helper `listRearCameras()` that returns `[{ deviceId, label, kind: 'main' | 'ultrawide' | 'tele' | 'unknown' }]` for the UI switcher.

### 2. In-overlay lens switcher

Update `src/lib/webPhotoCapture.ts` and `src/components/VinScanner.tsx`:

- Add a small `Lens` button in the camera overlay bar. Tapping it cycles through the rear cameras returned by `listRearCameras()`, restarting the stream on the chosen `deviceId` and re-applying `focusMode: continuous` + `zoom: 1`.
- Show a tiny label under the button (`Main` / `Ultra` / `Tele` / `Cam 2`) so the user can see which lens is active.
- Remember the user's last manual pick in `localStorage` (`chiptime.rearCameraId`) and prefer it on next open; fall back to the probe winner; fall back to `facingMode: 'environment'`.

### Files

- `src/lib/cameraSelect.ts` — rewrite: `pickMainRearCameraId()` uses probe-based scoring + `sessionStorage` cache + `localStorage` user override; add `listRearCameras()`.
- `src/lib/webPhotoCapture.ts` — add lens-switch button; persist user pick.
- `src/components/VinScanner.tsx` — add the same lens-switch button to the VIN overlay; persist user pick.

### Out of scope

No native (Capacitor) changes — native uses the OS camera UI, which already picks the main lens. No changes to OCR, storage, upload, or session/photo data model.

### Verification

You'll test on your Samsung after deploy: open VIN scan or session photo, confirm the default lens is the main rear (not ultra-wide), and confirm the new `Lens` button cycles to the correct one and is remembered next time.

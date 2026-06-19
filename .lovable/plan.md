## Problem

Two issues:

1. **Bug**: After picking the right lens with the in-overlay "Lens" button in the VIN scanner, the photo session still opens the wrong (ultra-wide) lens. Cause: `pickMainRearCameraId()` reads a `sessionStorage` cache (`SS_PROBED_PICK`) **before** checking the saved user pick in `localStorage`. When the user switches lenses, `saveRearCameraId()` writes to `localStorage` but never invalidates the session cache, so the next caller (web photo capture) returns the stale auto-pick.

2. **Missing**: No way to test and persist a chosen rear camera from Settings — the user has to keep switching lenses via the in-overlay button every time.

## Fix + Feature

### A. Fix the stale-cache bug — `src/lib/cameraSelect.ts`
- In `saveRearCameraId(deviceId)`, also write the same `deviceId` to `sessionStorage[SS_PROBED_PICK]` so subsequent calls return the user's choice immediately.
- In `clearSavedRearCameraId()`, also clear `SS_PROBED_PICK`.
- Add `clearProbedCameras()` helper that wipes both `SS_PROBED_LIST` and `SS_PROBED_PICK` (used by the Settings "Re-detect" action).

This single change makes the VIN scanner's lens switch carry over to photo sessions automatically.

### B. New "Camera" section in Settings

Add a Camera section to both `src/components/SettingsDialog.tsx` (mobile) and `src/components/DesktopSettingsView.tsx` (desktop) with:

- **Detected rear cameras** list (uses `listRearCameras()`), each row showing:
  - lens kind badge: `Main` / `Ultra` / `Tele` / `Cam`
  - the device label (or short id fallback)
  - zoom range when known (e.g. `0.5×–10×`)
  - a "Use this" radio / button that calls `saveRearCameraId(deviceId)`
  - a "Test" button that opens a small preview overlay streaming that exact `deviceId` for a few seconds so the user visually confirms the framing matches the lens they want — Capture button is hidden (preview only), Close button stops the stream.
- **Auto-detect** button → `clearSavedRearCameraId()` + `clearProbedCameras()`, then re-runs `listRearCameras()`.
- The currently saved deviceId is highlighted as "Active".
- On **native** (Capacitor) the OS picks the lens, so the section renders a short note: "On the installed app, your phone's camera picks the lens automatically." and hides the list.

### C. Wire-up confirmation

No changes needed in `webPhotoCapture.ts` or `VinScanner.tsx`: both already call `pickMainRearCameraId()` on open, which (after fix A) will return the Settings-saved deviceId.

## Files

- `src/lib/cameraSelect.ts` — patch `saveRearCameraId`, `clearSavedRearCameraId`, add `clearProbedCameras`.
- `src/components/CameraSettingsSection.tsx` *(new)* — self-contained UI with list, Test preview overlay, Auto-detect button.
- `src/components/SettingsDialog.tsx` — render `<CameraSettingsSection />` in the settings view.
- `src/components/DesktopSettingsView.tsx` — render the same section.

## Out of scope

No native camera changes, no changes to OCR / upload pipeline, no changes to photo storage.
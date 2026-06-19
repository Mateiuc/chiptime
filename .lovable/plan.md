## Goal

Now that lens selection is managed centrally in Settings → Camera, remove the redundant in-overlay "Lens" switchers and clean unused helpers. Also fix the web photo-session overlay where the bottom Cancel / Capture / Torch buttons are clipped by the phone's native navigation bar.

## Changes

### 1. `src/lib/webPhotoCapture.ts` — clean + safe-area fix
- Remove the "Lens" button, its label updater, and the `nextRearCameraId` / `listRearCameras` / `saveRearCameraId` / `lensKindLabel` imports.
- Keep only: `pickMainRearCameraId` (reads Settings choice), the video stream, Cancel / Torch / Capture buttons.
- Bottom bar fix:
  - Add `padding-bottom: max(16px, env(safe-area-inset-bottom))` to the button bar so it sits above the phone's nav-bar.
  - Add matching `padding-top: max(env(safe-area-inset-top), 0px)` so the top of the overlay does not slip under the status bar.
  - Use `100dvh` (dynamic viewport) by switching from `inset:0` to `top/left/right:0; height:100dvh; width:100vw;` so URL bars / nav bars are accounted for on mobile browsers.

### 2. `src/components/VinScanner.tsx` — remove in-overlay lens switcher
- Drop imports of `nextRearCameraId`, `listRearCameras`, `saveRearCameraId`, `lensKindLabel`, and the `RearCamera` type.
- Drop `RefreshCw` from the lucide import.
- Remove state: `currentCameraId`, `currentLensKind`, `rearCameraCount`.
- Remove the `switchLens()` function.
- Remove the post-stream code block that calls `listRearCameras()` to populate the lens label (lines ~249–260).
- Remove the "Lens Switcher" Button block in the JSX (lines ~789–803). Keep Torch and Zoom controls untouched.
- `startCamera` signature: drop the `overrideDeviceId` parameter (no longer used internally).

### 3. `src/lib/cameraSelect.ts` — drop now-unused exports
- Remove `nextRearCameraId()` (no remaining caller).
- Keep everything else (`listRearCameras`, `pickMainRearCameraId`, `saveRearCameraId`, `getSavedRearCameraId`, `clearSavedRearCameraId`, `clearProbedCameras`, `lensKindLabel`, `RearCamera`, `RearLensKind`) — all still used by `CameraSettingsSection.tsx` and the two camera consumers.

### Out of scope
- No change to `CameraSettingsSection.tsx` or to the native (Capacitor) photo path.
- No OCR / upload / business logic changes.
- No change to where photos are stored or how the session flow works.

## Verification
- Open a work session → Take photo: overlay fills the screen, Cancel / Torch / Capture all fully visible above the phone nav bar; lens used = the one saved in Settings (no Lens button shown).
- Open VIN scan: no Lens button in the camera overlay; Torch + Zoom still work; the camera used = Settings choice.
- Settings → Camera: list, Test, Use this, Auto-detect all still work.

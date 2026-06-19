## Goal

Use the same main-rear-camera lens selection for session photos as the VIN scanner, so phone captures stop landing on the ultra-wide lens.

## Where the capture lives today

`TaskCard.handleCapturePhoto` (around `src/components/TaskCard.tsx:536`) calls `Camera.getPhoto` from `@capacitor/camera`.

- **Native iOS/Android (Capacitor):** opens the system camera app, which already defaults to the main lens. No change needed.
- **Web / PWA:** `@ionic/pwa-elements` (`src/main.tsx`) renders a custom camera UI that calls `getUserMedia({ facingMode: 'environment' })` — same problem as the VIN scanner had: multi-lens phones can pick the ultra-wide lens.

## Plan

### 1. Extract the lens picker — `src/lib/cameraSelect.ts` (new)

Move `pickMainRearCameraId` out of `VinScanner.tsx` into a tiny shared util:

```ts
export async function pickMainRearCameraId(): Promise<string | null> { ... }
```

Same logic already shipped in VinScanner (reject ultra-wide/tele/depth/mono; prefer wide/main/1x/Back Camera).

Update `VinScanner.tsx` to import it instead of defining it locally. No behavior change for VIN.

### 2. Add a small web-only photo capture — `src/lib/webPhotoCapture.ts` (new)

Exposes `captureSessionPhotoWeb(): Promise<string | null>` returning a base64 JPEG (no `data:` prefix, matching what `Camera.getPhoto` returns) or `null` if the user cancels.

Implementation:
- Pick lens via `pickMainRearCameraId()`, open `getUserMedia({ deviceId: { exact } | facingMode: 'environment', width/height ideal 1920×1080 })`.
- Apply `focusMode: continuous`, `zoom: 1` advanced constraints (try/catch).
- Render a minimal full-screen overlay (plain DOM, no React) with `<video>` preview + **Capture** + **Cancel** buttons + torch toggle if `capabilities.torch` is reported. Tear down on either action.
- On capture: draw video frame to an off-screen `<canvas>` at the video's intrinsic resolution, `canvas.toDataURL('image/jpeg', 0.8)`, strip the `data:image/jpeg;base64,` prefix, return.

Keeps styling minimal (solid black backdrop, white buttons) — this is a utility surface, not a designed screen.

### 3. Route web captures through the new util — `src/components/TaskCard.tsx`

In `handleCapturePhoto`, branch on `Capacitor.isNativePlatform()`:

- **Native:** unchanged `Camera.getPhoto({...})`.
- **Web:** `const base64 = await captureSessionPhotoWeb(); if (!base64) return;` then continue with the existing `photo.base64String` pipeline (rename local var so the rest of the function reads `base64String` from either source).

No changes to storage, session/photo data model, toasts, or UI buttons.

## Out of scope

- No changes to the VIN scanner UI, OCR, zoom slider, or torch logic beyond the file split.
- No changes to native camera behavior — Capacitor still drives iOS/Android captures.
- No design system changes.

## Verification

- On a multi-lens phone using the published web app: tap **Add photo** on a task → custom capture overlay opens on the main lens (no fish-eye), snap saves the photo to the session as before.
- On native build: behavior is identical to today (system camera).
- VIN scanner continues to behave exactly as it does now.

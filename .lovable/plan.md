## Problem

On phones with multiple rear cameras (iPhone Pro, most modern Androids), `getUserMedia({ facingMode: 'environment' })` often hands back the **ultra-wide** lens. Ultra-wide lenses can't focus closely on a VIN plate, so the live preview is soft and OCR fails — exactly what the user is seeing.

## Fix — `src/components/VinScanner.tsx`, `startCamera()` only

Replace the single `getUserMedia` call with a small selection routine that prefers the **main rear (wide) camera**:

1. Do an initial `getUserMedia({ video: { facingMode: 'environment' } })` to unlock device labels (browsers hide labels until permission is granted), then immediately stop those tracks.
2. `navigator.mediaDevices.enumerateDevices()` → filter `kind === 'videoinput'`.
3. From the rear cameras (label contains `back` / `rear` / `environment`, or fall back to all video inputs if none match), pick the best candidate in this order:
   - **Reject** any label containing `ultra`, `ultrawide`, `ultra wide`, `0.5`, `telephoto`, `tele`, `depth`, `mono`, `ir`.
   - **Prefer** labels containing `wide` (but not `ultra wide`), `main`, `back camera` (iOS exposes the main lens as plain "Back Camera"), or `1x`.
   - Otherwise fall back to the first remaining rear camera.
4. Re-open the stream with `{ video: { deviceId: { exact: chosenId }, width: { ideal: 1920 }, height: { ideal: 1080 } } }`. If that fails, fall back to the original `facingMode: 'environment'` request so nothing regresses on older devices.
5. After the track is live, also push `advanced: [{ focusMode: 'continuous' }, { zoom: 1 }]` via `applyConstraints` (wrapped in try/catch). The `zoom: 1` nudges multi-lens Android stacks back to 1× (main lens) when the OS exposes a logical multi-camera. `focusMode: continuous` keeps the VIN sharp as the user moves the phone.

Everything downstream (`setStream`, capabilities check for zoom/torch, OCR pipeline) stays unchanged — the new code only changes *which* track is opened.

## Out of scope

- No changes to OCR providers, UI, zoom slider, torch button, or Tesseract tuning.
- No changes to other camera surfaces (vehicle photo capture, etc.).
- No new dependencies.

## Verification

After the change, on a multi-lens phone the preview should look noticeably tighter (no fish-eye) and focus on a VIN plate held ~20–30 cm away. The zoom slider should still appear on Android devices that expose `zoom` capability.

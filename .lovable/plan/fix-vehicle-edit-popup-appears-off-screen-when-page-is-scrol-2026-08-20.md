# Fix: vehicle edit popup appears off-screen when page is scrolled

## Problem

On the desktop dashboard, clicking **Edit** on a vehicle far down the client's vehicle list opens the edit popup at the very top of the page, above the visible area. You have to scroll all the way back up to see or use it.

## Cause

The shared dialog component positions its overlay and panel with `absolute inset-0`. That was done so popups stay inside the mobile phone frame. On desktop there is no phone frame, so the popup anchors to the top of the whole document instead of the visible screen — scrolled down, it ends up far above the viewport.

## Fix

Make the dialog position itself based on where it is rendered:

- Inside the mobile phone frame: keep `absolute` (current behaviour, unchanged).
- On desktop (no phone frame): use `fixed` so the overlay and panel always cover the visible screen, no matter the scroll position.

Also make sure the popup body scrolls internally on short screens so the Save/Cancel buttons stay reachable.

## Technical notes

- `src/components/ui/dialog.tsx`: the `DialogPortal` already detects `.mobile-phone-frame`. Expose that detection (small context or shared hook) so `DialogOverlay` and `DialogContent` swap `absolute` → `fixed` when the container is `document.body`.
- Keep the existing fullscreen-fallback class logic intact so mobile dialogs render exactly as today.
- Verify on the desktop dashboard: scroll to the bottom of a long vehicle list, click Edit, confirm the dialog is centred in view and Save works. Also spot-check a mobile dialog to confirm no regression.

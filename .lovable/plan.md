

# Fix: VIN Guide Box Too Short — Add Vertical Padding

## Problem
After the resolution fix, the 1/11 aspect ratio box is now correctly scaled to CSS pixels. But it's too tight vertically — it barely fits the VIN characters, leaving no margin for camera alignment. OCR needs some surrounding context to reliably detect text.

## Solution
Change aspect ratio from `1/11` to `1/7`. This gives roughly 2x the character height as padding above and below the VIN text, making it easier to align while still being a narrow horizontal strip.

- On a 400px phone: `400 × 90% / 7 ≈ 51px` (was ~33px)
- On a 800px tablet: `800 × 90% / 7 ≈ 103px` (was ~65px)

## Change — `src/components/VinScanner.tsx` (line 112)

```typescript
// Before
const ASPECT_RATIO = 1 / 11;

// After
const ASPECT_RATIO = 1 / 7;
```

Also update the comment on line 110 to reflect the new ratio.

One line changed in one file.


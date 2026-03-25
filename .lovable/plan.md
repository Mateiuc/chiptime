

# Improve Tesseract VIN OCR Based on Real Scan Analysis

## Problem Analysis

Looking at storage: **9 failures, 1 success** from the latest session. The current pipeline has several issues that hurt recognition on real door-jamb VIN stickers:

1. **Otsu binarization is destructive**: On metallic/silver VIN stickers, Otsu can pick the wrong threshold and invert text polarity (black text becomes white-on-black or gets washed out). The full binary threshold (0 or 255) destroys anti-aliasing that Tesseract's LSTM engine actually uses for recognition.

2. **Guide box at 1/17 is extremely thin** (~55px on 1080p video). While mathematically correct for 17 square characters, real VIN stickers have characters that are taller than wide (typical monospace font). A character aspect ratio of ~1.5:1 (height:width) means the actual VIN text band is more like 1.5/17 ≈ 1/11.

3. **JPEG compression after binarization**: Binary images (pure black/white) should not be saved as JPEG — JPEG artifacts create noise around sharp edges. The binarized image gets saved at 0.98 quality, which still introduces ringing artifacts that confuse OCR.

## Changes

### 1. Replace Otsu binarization with gentler preprocessing — `src/components/VinScanner.tsx`

**Both manual (line 391-423) and auto scan (line 582-605)**:

Replace the hard Otsu binary threshold with a softer approach:
- Grayscale conversion (keep)
- **Contrast stretch** instead of binary threshold: map the darkest 5% to 0 and brightest 5% to 255, linearly stretch everything in between. This preserves character edge detail while improving contrast.
- This avoids the polarity-flip problem and keeps anti-aliasing intact for Tesseract's LSTM engine.

```typescript
// Contrast stretch (percentile-based)
const sorted = [...grays].sort((a, b) => a - b);
const lo = sorted[Math.floor(sorted.length * 0.05)];
const hi = sorted[Math.floor(sorted.length * 0.95)];
const range = Math.max(hi - lo, 1);
for (let i = 0; i < data.length; i += 4) {
  const stretched = Math.min(255, Math.max(0, ((grays[i/4] - lo) / range) * 255));
  data[i] = data[i+1] = data[i+2] = stretched;
}
```

### 2. Use PNG for Tesseract input — `src/components/VinScanner.tsx`

Change `canvas.toDataURL('image/jpeg', 0.98)` to `canvas.toDataURL('image/png')` for the base64 sent to Tesseract. PNG is lossless — no JPEG artifacts around character edges. Keep JPEG for the uploaded frame (smaller file size for storage).

**Manual mode (line 425-426)**: Use PNG for OCR, JPEG for upload.
**Auto mode (line 608)**: Use PNG for Tesseract, JPEG for other providers.

### 3. Increase guide box to 1/11 — `src/components/VinScanner.tsx` (line 112)

Change `ASPECT_RATIO` from `1/17` to `1/11`. Real VIN characters are taller than wide. This gives ~83px on 1080p — enough vertical margin for slight misalignment and enough character height for reliable recognition, while still being a thin horizontal strip.

### 4. Upscale threshold increase — `src/components/VinScanner.tsx` (lines 377, 568)

Change upscale trigger from `sh < 80` to `sh < 120`. Tesseract works best with character heights of 30-40px. With 1/11 ratio on 1080p, crop height is ~83px before upscaling. Upscaling to ~166px ensures characters are large enough.

### 5. Update blur mask gradient — `src/components/VinScanner.tsx`

Adjust mask gradient padding to match new box height.

## Files
- `src/components/VinScanner.tsx` — aspect ratio, preprocessing, PNG format, upscale threshold, mask
- `src/lib/tesseractVinOcr.ts` — no changes needed (parameters already correct)


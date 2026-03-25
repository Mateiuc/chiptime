

# Fix VIN Scanner Guide Box Aspect Ratio

## Problem
The guide box at 1/16 is still too tall. A VIN is 17 characters with no spaces. If each character is roughly square (1:1), the natural aspect ratio of the text is 1:17 (height:width).

## Change — `src/components/VinScanner.tsx` (line 112)

Change `ASPECT_RATIO` from `1/16` to `1/17`:
```typescript
const ASPECT_RATIO = 1 / 17;
```

Also update the comment on line 110 to reflect the new ratio.

Additionally, the Tesseract and preprocessing improvements from the previously approved plan will be applied:
- Remove `tessedit_char_whitelist` in `src/lib/tesseractVinOcr.ts` — let Tesseract see all chars, rely on `cleanText()` for O→0, I→1
- Add `tessedit_ocr_engine_mode: '2'` (Legacy+LSTM)
- Replace linear contrast with adaptive binarization (Otsu threshold) in both manual and auto scan preprocessing
- Upscale 2x if crop height < 80px
- Adjust blur mask gradient to match thinner box

## Files
- `src/components/VinScanner.tsx` — aspect ratio + preprocessing
- `src/lib/tesseractVinOcr.ts` — engine parameters


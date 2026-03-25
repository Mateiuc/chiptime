

# Save All Manual Capture Frames (Success + Failure) for OCR Analysis

## Problem
Currently `uploadFailedFrame` only runs when OCR **fails** to find a VIN (line 400). When a VIN is successfully detected, the frame is NOT saved. The user wants ALL manual Tesseract captures saved for future analysis and OCR tuning.

## Changes — `src/components/VinScanner.tsx`

### 1. Rename and generalize upload function (line 261)
Rename `uploadFailedFrame` → `uploadScanFrame` and add a `success` parameter:
- File path: `{timestamp}_{provider}_{success|fail}.jpg`
- Also upload a `.json` metadata sidecar with: provider, rawText, candidates, success boolean, detected VIN (if any)

### 2. Upload on success too (after line 396)
Add `uploadScanFrame(base64, providerToUse, result, true)` right before `onVinDetected` so successful frames are also saved for reference.

### 3. Save metadata as JSON sidecar (inside uploadScanFrame)
After uploading the JPEG, also upload a small JSON file with the same name but `.json` extension containing:
```json
{
  "provider": "tesseract",
  "success": true,
  "vin": "1HGBH41JXMN109186",
  "rawText": "1HGBH41JXMN109186",
  "candidates": [...],
  "timestamp": 1711234567890
}
```

This gives full context when reviewing saved frames later.

### Summary
- 1 file changed: `src/components/VinScanner.tsx`
- ~15 lines modified total
- Both successful and failed manual captures will be saved with full metadata


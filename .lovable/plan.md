

# Fix VIN Scanner: Guide Box Too Tall & OCR Not Recognizing

## Problems
1. **Guide box too tall**: Aspect ratio `1:8` makes the box ~216px tall on 1920px video — way too tall for a single VIN line, capturing excess background that confuses OCR
2. **No preprocessing in auto scan**: The continuous scan loop (line 506-513) sends raw camera frames with no grayscale/contrast enhancement. Manual mode applies preprocessing only for Tesseract but not other providers
3. **Lower quality in auto mode**: Auto scan uses 0.9 JPEG quality vs 0.98 in manual mode

## Changes — `src/components/VinScanner.tsx`

### 1. Reduce guide box height (line 112)
Change aspect ratio from `1/8` to `1/16` — a much thinner strip that tightly fits a single VIN text line:
```typescript
const ASPECT_RATIO = 1 / 16; // was 1 / 8
```

### 2. Add preprocessing to continuous scan (after line 509)
After `context.drawImage(...)` in the auto scan loop, apply the same grayscale + contrast boost currently only used in manual/tesseract mode:
```typescript
// Apply grayscale + contrast for better OCR
const imageData = context.getImageData(0, 0, sw, sh);
const data = imageData.data;
for (let i = 0; i < data.length; i += 4) {
  const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  const contrasted = Math.min(255, Math.max(0, ((gray - 128) * 1.5) + 128));
  data[i] = data[i+1] = data[i+2] = contrasted;
}
context.putImageData(imageData, 0, 0);
```

### 3. Increase JPEG quality in auto scan (line 512)
Change from `0.9` to `0.95` for better text clarity.

### 4. Apply preprocessing for all providers in manual mode (line 357)
Remove the `if (providerToUse === 'tesseract')` condition so grayscale+contrast is applied for all OCR providers, not just Tesseract.

### 5. Update blur mask to match thinner box (line 594)
Adjust the mask gradient `heightPx + 40` to `heightPx + 20` since the box is thinner now.


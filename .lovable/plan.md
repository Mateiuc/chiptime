

# Fix: VIN Guide Box Too Tall — Resolution Mismatch

## Root Cause

The guide box height is calculated from `video.videoWidth` (native camera resolution, e.g. **1920px**), but applied as **CSS pixels** to the on-screen element. The video is displayed much smaller (e.g. ~400px wide on a phone screen), so the box ends up 3-4x too tall.

Example: `1920 × 90% = 1728 → 1728 / 11 = 157px CSS height` — but the displayed video is only ~400px wide, where correct height would be `400 × 90% / 11 ≈ 33px`.

## Fix — `src/components/VinScanner.tsx`

### 1. Calculate from displayed element size, not native resolution (lines 111-122, 124-147)

Replace `videoWidth` (native resolution) with the **container's rendered width** (`containerRef.current.clientWidth`) for the CSS guide box dimensions.

Keep using native `video.videoWidth` for the crop coordinates (since canvas captures at native resolution), but the UI box must use CSS pixel dimensions.

```typescript
const calculateFrameDimensions = (displayedWidth: number) => {
  const ASPECT_RATIO = 1 / 11;
  const widthPercent = 90;
  const guideWidth = displayedWidth * (widthPercent / 100);
  const guideHeight = guideWidth * ASPECT_RATIO;
  return { widthPercent, heightPx: Math.round(guideHeight) };
};
```

In the `useEffect` that sets dimensions, use `containerRef.current.clientWidth` instead of `video.videoWidth`:

```typescript
const containerWidth = containerRef.current?.clientWidth || video.clientWidth;
const dimensions = calculateFrameDimensions(containerWidth);
```

### 2. Add resize listener (new, after line 147)

Add a `ResizeObserver` on the container so the box adapts if the viewport changes (rotation, resize):

```typescript
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  const observer = new ResizeObserver(() => {
    if (container.clientWidth > 0) {
      setFrameDimensions(calculateFrameDimensions(container.clientWidth));
    }
  });
  observer.observe(container);
  return () => observer.disconnect();
}, []);
```

### 3. Crop coordinates still use native resolution (no change needed)

The canvas crop logic already uses `video.videoWidth`/`video.videoHeight` for the actual pixel capture — this is correct and stays unchanged. Only the visual guide box sizing changes.

## Result
On a phone with 400px displayed width: `400 × 90% / 11 ≈ 33px` — a thin single-line strip. On a tablet with 800px width: `800 × 90% / 11 ≈ 65px`. Always proportional to displayed size.

## File
- `src/components/VinScanner.tsx` — 1 function update + 1 new ResizeObserver effect


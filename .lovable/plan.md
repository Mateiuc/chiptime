

## Fix: Client Portal Not Scrollable

### Root Cause

The entire app is wrapped in a `mobile-phone-frame` container (in `App.tsx` line 17) which has `overflow: hidden` and a fixed `height: 844px` set in `index.css` (line 101). This means any content taller than 844px is clipped and cannot be scrolled.

The Client Portal page uses `min-h-screen` which expands beyond this fixed frame, but the parent container blocks scrolling.

### Fix

Add `overflow-y: auto` to the `.mobile-phone-frame` class in `src/index.css` so content inside the frame can scroll naturally.

**File:** `src/index.css` (line 101, the `.mobile-phone-frame` rule)

Add one property:
```css
overflow-y: auto;
```

This changes the frame from clipping overflow to allowing vertical scrolling, which fixes the portal and any other page that exceeds the frame height.

### Technical Details

| File | Change |
|------|--------|
| `src/index.css` (line 101) | Add `overflow-y: auto;` to `.mobile-phone-frame` |

Single-line change. No other files affected.


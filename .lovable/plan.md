

## Remove Scrollbar from Everywhere

Hide the scrollbar globally while keeping scroll functionality intact.

### Change

**File: `src/index.css`** -- Add scrollbar-hiding rules in the `@layer base` section:

```css
/* Hide scrollbars globally */
* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
*::-webkit-scrollbar {
  display: none;
}
```

This removes visible scrollbars from all elements (including the mobile phone frame, dialogs, and the client portal) across all browsers while preserving scroll functionality via touch/trackpad/mouse wheel.

Single file change, no other files affected.


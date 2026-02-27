

# Make Edit Task Dialog Full-Page with Color

## Problem
User wants: (1) not a floating window — should be full-page, and (2) bring back colors like the mobile version has, instead of plain white/black.

## Changes — `src/components/EditTaskDialog.tsx`

### 1. Make desktop layout full-page (not a centered modal)
- Change desktop `DialogContent` className from centered modal (`left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-5xl w-[92%] max-h-[90vh]`) to fullscreen like mobile (`inset-0 w-full h-full max-w-none max-h-none`)
- Keep `flex flex-col overflow-hidden` structure

### 2. Add color back to desktop layout
- **Header**: Use `colorScheme.gradient` background (like mobile) instead of plain white with a thin stripe
- **Session cards**: Use `sessionColorScheme.session` background + border classes instead of plain `bg-card border`
- **Period rows**: Use `sessionColorScheme.period` background instead of plain `bg-background`
- **Parts table header**: Use session color tint instead of `bg-muted/50`
- **Parts rows**: Use `sessionColorScheme.part` background
- **Duration badge**: Keep `bg-primary/10 text-primary` — already has color

### 3. Keep desktop-specific improvements
- Keep the larger text sizes, horizontal period rows, parts table layout
- Keep generous spacing (`p-5`, `gap-3`, etc.)
- These work fine full-page — the only issues were the window and lack of color

### Files changed
- `src/components/EditTaskDialog.tsx` — desktop section only (lines 686-851)


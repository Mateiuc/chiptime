

# Fix Edit Task Dialog Centering on Desktop

## Problem
The base `DialogContent` in `src/components/ui/dialog.tsx` uses `absolute inset-0 w-full h-full` — designed for mobile fullscreen. The desktop `max-w-4xl max-h-[85vh]` classes on EditTaskDialog get overridden, making it either tiny or mispositioned.

## Changes

### 1. `src/components/ui/dialog.tsx` — Support centered mode
- Change `DialogContent` default className from `absolute inset-0 w-full h-full` to allow overriding
- When a className containing `max-w-` is passed, it should center (using `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`) instead of filling fullscreen

### 2. `src/components/EditTaskDialog.tsx` — Use proper centered desktop classes
- Desktop className: `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-4xl w-[90%] max-h-[85vh] p-0 rounded-lg flex flex-col overflow-hidden`
- This centers the dialog as a proper modal window on desktop

### Files changed
- `src/components/ui/dialog.tsx`
- `src/components/EditTaskDialog.tsx`


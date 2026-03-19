

# Add "Add Key" and "All Keys Lost" Session Flags

## Overview
Add two new per-session billing flags — **Add Key** and **All Keys Lost** — following the exact same pattern as the existing Cloning and Programming flags. These appear in:
1. **CompleteWorkDialog** (mobile work completion)
2. **EditTaskDialog** (mobile + desktop session editing)
3. **WorkSession type** + all cost calculation logic

## Changes

### 1. `src/types/index.ts` — Add fields to WorkSession
Add `isAddKey?: boolean` and `isAllKeysLost?: boolean` to the `WorkSession` interface.

### 2. `src/components/CompleteWorkDialog.tsx`
- Add `isAddKey` and `isAllKeysLost` state + switches (using `Key` and `KeyRound` icons from lucide)
- Update `onComplete` callback signature to include both new flags
- Reset them on complete
- Add two new Switch rows after Programming in the Billing Options section

### 3. `src/pages/Index.tsx` — `handleCompleteWork`
- Update signature to accept `isAddKey` and `isAllKeysLost`
- Set them on the target session (same as `isCloning`/`isProgramming`)

### 4. `src/components/EditTaskDialog.tsx`
- Add toggle buttons for `isAddKey` and `isAllKeysLost` in both mobile and desktop session headers (next to Cloning/Programming buttons)
- Use `Key` and `KeyRound` icons

### 5. `src/pages/DesktopDashboard.tsx` — Cost calculations
- Add `addKeyRate` and `allKeysLostRate` from client/settings
- Include `isAddKey`/`isAllKeysLost` costs in all cost calculation blocks (lines ~240, ~415, ~494, ~533)

### 6. Files changed
- `src/types/index.ts`
- `src/components/CompleteWorkDialog.tsx`
- `src/pages/Index.tsx`
- `src/components/EditTaskDialog.tsx`
- `src/pages/DesktopDashboard.tsx`


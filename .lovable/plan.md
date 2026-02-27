

# Redesign Edit Task Dialog — Clean Desktop Layout from Scratch

## Problem
The current dialog is a mess of conditional `d ?` ternaries everywhere, producing an awkward stretched version of the mobile layout. The user wants a fresh, clean design for desktop.

## Approach
Rewrite the JSX rendering section (lines 448-759) for the desktop case with a completely separate, clean layout — not a mobile layout with bigger spacing. Keep the mobile path unchanged.

## Changes — `src/components/EditTaskDialog.tsx`

### 1. Split rendering: mobile vs desktop
- Extract the desktop body into its own block rather than littering every element with `d ?` conditionals
- Use `if (isMobile) return <MobileLayout />` / `return <DesktopLayout />` pattern, or a single return with two distinct branches

### 2. Desktop dialog design
- **Dialog**: `max-w-5xl w-[92%] max-h-[90vh]` centered with the existing `left-1/2 top-1/2` approach
- **Header**: Clean bar with task title, subtle color accent as a left border stripe (not full gradient background)
- **Body**: Two-column layout when there are sessions:
  - Left column (sessions list): scrollable list of session cards
  - Each session card: clean white card with shadow, rounded corners
- **Session card interior**:
  - Session title + date on one line, delete icon on right
  - Periods as a simple table-like row: `Start [date] [time] → End [date] [time] | duration | 🗑️`
  - Parts as a simple table: Name | Qty | Price | Total | 🗑️
  - Description textarea at the bottom
  - Add Period / Add Part buttons inline
- **Footer**: Standard right-aligned buttons: `Delete Car | Add Session | Cancel | Save Changes`

### 3. Clean styling principles
- No gradient backgrounds on cards — use white/card background with subtle border
- Inputs: standard `h-10` with proper labels above
- Consistent `gap-4` spacing
- Session cards separated by `space-y-4`
- Period rows: horizontal flex layout, not nested grid cards
- Parts: simple horizontal row per part

### 4. Mobile layout stays untouched
- Keep existing mobile JSX as-is (the `isMobile` branch)

### Files changed
- `src/components/EditTaskDialog.tsx` — complete desktop rendering rewrite




# Redesign Edit Task Dialog for Desktop

## Problem
The edit dialog uses cramped, phone-optimized styling — tiny text (`text-xs`, `text-[10px]`), minimal padding (`p-1`), stacked button labels — which looks ugly on desktop.

## Changes — `src/components/EditTaskDialog.tsx`

### 1. Desktop-aware layout throughout
- On desktop: use generous spacing (`p-4`, `space-y-4`, `gap-4`), normal text sizes (`text-sm`, `text-base`), and wider inputs
- On mobile: keep current compact layout
- Use `isMobile` (already available) to conditionally apply classes

### 2. Improved session cards
- Desktop: `p-4 space-y-4 rounded-lg` with clear section headers using border-bottom separators
- Session header: larger font, date displayed more prominently
- Period cards: side-by-side Start/End with proper labels and spacing, duration shown as a badge

### 3. Better period time inputs
- Desktop: date and time inputs side-by-side with proper width, `h-10` height, `text-sm` font
- Grid layout: `grid-cols-2 gap-6` for Start/End columns on desktop

### 4. Parts section cleanup
- Desktop: part name input full width with proper height, quantity/price/description in a 3-column grid
- Total shown as a styled badge instead of plain text

### 5. Footer buttons
- Desktop: normal horizontal buttons with proper padding, no stacked text
- Clean spacing with `gap-3`

### 6. Dialog header
- Show task name (vehicle info) in the header title instead of just "Edit"
- Slightly larger header padding on desktop

### Files changed
- `src/components/EditTaskDialog.tsx` — responsive desktop-friendly redesign


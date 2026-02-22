

## Responsive Client Portal: Tablet and Desktop Only

### Principle
The phone layout stays **exactly as it is today** -- zero changes for screens under 768px. Enhancements only apply to tablet (768-1024px) and desktop (over 1024px).

### Approach
Use Tailwind's responsive prefixes (`md:` and `lg:`) directly in the existing components. No custom hook needed -- Tailwind handles the breakpoints in CSS, so phone rendering is completely untouched.

### Changes

**File: `src/pages/ClientPortal.tsx`**

- Wrap the main content area in a centered container that only constrains width on larger screens:
  - `md:max-w-[720px] lg:max-w-[960px] md:mx-auto`
- Header: on tablet/desktop, put the logo and tabs on a single row instead of stacked:
  - `md:flex md:items-center md:justify-between md:space-y-0` (tabs sit beside the logo)
  - Tabs list loses `w-full` on larger screens: `md:w-auto`
- PIN screen card: allow slightly wider card on tablet/desktop:
  - `md:max-w-sm lg:max-w-md`
- Add more padding on larger screens: `md:p-8 lg:p-12`

**File: `src/components/ClientCostBreakdown.tsx`**

- Vehicle cards: on desktop, display in a 2-column grid when there are multiple vehicles:
  - Wrap vehicle list in `lg:grid lg:grid-cols-2 lg:gap-4` (single column stays on phone and tablet)
- Greeting text: larger on bigger screens:
  - `md:text-2xl lg:text-3xl` on the name heading
- Session text and parts table: slightly larger text on tablet/desktop:
  - Session title: `md:text-base` (currently `text-sm`)
  - Parts table cells: `md:text-sm` (currently `text-xs`)
  - Status badge: `md:text-xs` (currently `text-[10px]`)
- Grand total card: centered with max-width on larger screens:
  - `md:max-w-lg md:mx-auto`
- Vehicle subtotal section: more padding on larger screens:
  - `md:p-4 md:text-sm`

### What stays the same
- All current phone styling (everything under 768px) is preserved exactly as-is
- No new files or hooks needed
- No JavaScript-based device detection -- pure CSS breakpoints via Tailwind

### Files to modify

| File | Change |
|------|--------|
| `src/pages/ClientPortal.tsx` | Add `md:` and `lg:` Tailwind classes for layout, header, and padding |
| `src/components/ClientCostBreakdown.tsx` | Add `md:` and `lg:` classes for grid, text sizing, and spacing |


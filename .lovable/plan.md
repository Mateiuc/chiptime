## Problem
On desktop, `ScheduleEntryDialog` renders as a narrow `max-w-md` panel pinned to the left edge (looks like a side sheet), with all fields stacked single-column — wastes horizontal space and looks broken.

## Fix
File: `src/components/ScheduleEntryDialog.tsx`

Make the dialog responsive: stays mobile-friendly on small screens, becomes a polished centered modal with a 2-column grid on desktop.

1. **DialogContent sizing**
   - Change `max-w-md` → `max-w-md sm:max-w-2xl lg:max-w-3xl`
   - Keep `max-h-[90vh] overflow-y-auto`
   - Add subtle `p-0` wrapper + sticky header/footer so the form scrolls cleanly

2. **Header**
   - Sticky top bar with title + subtle subtitle (e.g. "Plan upcoming work for a client")
   - Border-bottom, padded

3. **Body layout** — 2-column grid on `sm:` and up:
   - **Left column**: Client, Vehicle (+ inline new-vehicle card spans full width when open), Assigned worker
   - **Right column**: Date + Time (kept as their own 2-col mini grid), Requested work (textarea, taller), Notes
   - On mobile: single column (current behavior)
   - Use `grid grid-cols-1 sm:grid-cols-2 gap-4 p-5`

4. **New-vehicle inline card**
   - When open, make it span both columns (`sm:col-span-2`) so the make/model/year/color grid has room
   - Tighten spacing; keep current fields & logic untouched

5. **Footer**
   - Sticky bottom bar, border-top, right-aligned Save/Cancel, Delete stays left
   - Slightly larger Save button

## Out of scope
- No logic changes (save handler, VIN decode, validation all unchanged)
- No changes to `ScheduleView` or mobile usage — the dialog already adapts via responsive classes
- No changes to the VIN scanner overlay

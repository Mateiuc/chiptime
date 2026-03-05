

# Fix: Move "Money Over Time" chart inside scrollable content

## Problem
The "Money Over Time" chart block (lines 974-1009) is rendered **outside** the scrollable `div` (which closes at line 971 with `</div>` and `)}`) — making it fixed/stuck at the bottom of the viewport, covering half the page.

## Solution
Move the entire "Money Over Time" chart block to **inside** the scrollable content div, right after the Revenue Charts section (after line 969, before the closing `</div>` at line 970). This places it in the normal document flow, scrollable, and visually below "Expected Gain."

Also match the styling to "Expected Gain" — use `rounded-xl` border instead of `rounded-lg`, and keep the same height for the chart area (250px like Expected Gain charts instead of 300px).

### File to edit
- `src/pages/DesktopDashboard.tsx` — cut lines 974-1009 and paste them before line 970, adjusting card styling to match Expected Gain.


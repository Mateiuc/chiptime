

# Fix PDF "BALANCE DUE" Overlap Issue

## Problem
The "BALANCE DUE:" label at font size 16 starting at x=145.9mm is too long and overlaps with the right-aligned dollar amount at x=192.9mm. The user wants to keep "TOTAL:" as the label always, with deposit/subtotal info shown as separate lines above.

## Changes

### 1. Desktop Bill PDF — `src/pages/DesktopDashboard.tsx` (line 407)
Change `prepaid > 0 ? 'BALANCE DUE:' : 'TOTAL:'` back to just `'TOTAL:'`. The deposit breakdown (Subtotal + Deposit lines) above it already makes the context clear.

### 2. Mobile Bill PDF — `src/components/TaskCard.tsx` (line 502)
Change `'BALANCE DUE:'` to `'TOTAL:'`. Same reasoning — Subtotal and Deposit lines are shown above.

### 3. Mobile Preview PDF — `src/components/TaskCard.tsx` (line 874)
Change `'BALANCE DUE:'` to `'TOTAL:'`. Same fix.

All three PDFs already show "Subtotal" and "Deposit" lines above when a deposit exists, so the final "TOTAL:" line will display the correct balance amount without any label overlap.

The UI elements (TaskCard cost summary, Desktop vehicle header) keep "Balance Due" text since those use HTML layout and don't have overlap issues.


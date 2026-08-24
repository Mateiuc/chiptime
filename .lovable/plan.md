# Rename deposit and due labels on desktop dashboard

## What changes

The client header row in the desktop dashboard currently shows:

```text
Total: $2,851    Due: $851    Deposit Left: $1,732    Full Deposit: $2,000
```

Chosen labels:

- **"Due"** → **"Still to Pay"**
- **"Deposit Left"** → **"After Billed"**
- **"Deposit Over"** → **"Over After Billed"** (keeps red styling)
- "Car Deposit Left" / "Car Deposit Over" stay unchanged per request (only the two client-level labels above).
- "Full Deposit" / "Full Car Deposit" stay as-is.

## Scope

Display-only change. No calculations or logic change — only the strings rendered in `src/pages/DesktopDashboard.tsx` (lines ~1589 and ~1602–1605).

## Files to edit

- `src/pages/DesktopDashboard.tsx`


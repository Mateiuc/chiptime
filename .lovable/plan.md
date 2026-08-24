# Rename deposit and due labels on desktop dashboard

## What changes

The client header row in the desktop dashboard currently shows:

```text
Total: $2,851    Due: $851    Deposit Left: $1,732    Full Deposit: $2,000
```

These labels are confusing. We will rename them to make the meaning obvious:

- **"Due"** → **"Still to Pay"** (or "Balance Due" if preferred)
- **"Deposit Left"** → **"After Billed"** (or "Remaining After Billed")
- **"Deposit Over"** → **"Over After Billed"** (keeps red styling)
- **"Car Deposit Left"** → **"Car After Billed"** for consistency
- **"Car Deposit Over"** → **"Car Over After Billed"**
- **"Full Deposit" / "Full Car Deposit"** stay as-is (they clearly show the original amount)

## Options to choose from

| Current label | Option A (recommended) | Option B | Option C |
|---|---|---|---|
| Due | Still to Pay | Balance Due | Owed |
| Deposit Left | After Billed | Remaining After Billed | Deposit After Bills |
| Deposit Over | Over After Billed | Over-deposit | Exceeded Deposit |
| Car Deposit Left | Car After Billed | Car Remaining After Billed | Vehicle After Billed |

Recommended set: **Still to Pay**, **After Billed**, **Over After Billed**, **Car After Billed**, **Car Over After Billed**.

## Scope

Display-only change. No calculations or logic change — only the strings rendered in `src/pages/DesktopDashboard.tsx` (lines ~1589 and ~1594–1605).

## Files to edit

- `src/pages/DesktopDashboard.tsx`

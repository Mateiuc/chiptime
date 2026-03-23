

# Fix: Mobile TaskCard Shows Gross Total Instead of Balance Due

## Problem
The mobile TaskCard's top summary shows the full `totalCost` ($3,713.53) even when a deposit exists. The deposit/balance due breakdown only appears inside the expanded "Details" section. The user expects the main "Cost" field to show the balance due amount.

## Changes

### `src/components/TaskCard.tsx`

**1. Top summary "Cost" field (line 1403-1406)**
Change the displayed amount from `totalCost` to the balance due when a deposit exists:

```
// Current (line 1405):
{formatCurrency(totalCost)}

// Fixed:
{formatCurrency((vehicle?.prepaidAmount || 0) > 0 ? Math.max(0, totalCost - vehicle!.prepaidAmount!) : totalCost)}
```

**2. Share bill totalAmount (lines 1050, 1082)**
The share dialog sends `formatCurrency(total)` where `total` is `totalCost` from the bill generator. This should also show balance due:

```
// Lines 1050 and 1082:
totalAmount: formatCurrency((vehicle?.prepaidAmount || 0) > 0 ? Math.max(0, total - (vehicle?.prepaidAmount || 0)) : total),
```

**3. ShareBillDialog default message (line 38 of ShareBillDialog.tsx)**
The default message says `Total: ${totalAmount}` — since we're now passing balance due, this is correct as-is.

Only file changed: `src/components/TaskCard.tsx` (3 spots).


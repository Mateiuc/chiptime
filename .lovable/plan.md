## Phase 5 — Tab-aware Grand Total labels and remove PAID IN FULL duplicate

### Scope
Only `src/components/ClientCostBreakdown.tsx` is affected. Per-vehicle summary cards, other line items, and all other surfaces are untouched.

### Change 1 — Tab-aware Grand Total label

In the bottom Grand Total card (currently line 426), replace the static `"GRAND TOTAL:"` label with a conditional label driven by the `filter` prop:

- `filter === 'pending'` → `"TOTAL"`
- `filter === 'billed'` → `"TOTAL DUE"`
- `filter === 'paid'` → `"TOTAL PAID"`
- `filter` undefined → `"GRAND TOTAL"` (fallback, preserves existing behavior)

The value text color already switches per tab (blue / amber / green) and stays exactly as-is.

### Change 2 — Add "PAID IN FULL" chip on Paid tab

When `filter === 'paid'`, render a small green status chip immediately to the right of the currency value on the TOTAL PAID line:

- Chip text: `✓ PAID IN FULL`
- Chip style: rounded-full, green tint (`bg-green-500/15`, `border-green-500/30`, `text-green-700 dark:text-green-300`), `text-[10px]` font-bold

### Change 3 — Remove duplicate "PAID IN FULL $X" row

In the IIFE block below the Grand Total line (currently lines 431–448), the `isPaid` branch renders a second green line that repeats the total amount. Remove this entire branch so only the deposit summary lines remain on the Paid tab:

- Vehicle Deposits line stays (informational).
- Client Deposit line stays.
- The `PAID IN FULL $X` duplicate row is deleted.
- The non-paid `BALANCE DUE` logic is unchanged.

### Before / After

**In Progress tab**
```
Total Labor:    $1,407
Total Parts:        $0
TOTAL:          $1,407   ← was "GRAND TOTAL", color stays blue
```

**Billed tab**
```
Total Labor:    $1,105
Total Parts:      $120
TOTAL DUE:      $1,225   ← was "GRAND TOTAL", color stays amber
```

**Paid tab (single vehicle)**
```
Total Labor:    $4,921
Programming:      $170
Total Discount:  -$591
Total Parts:      $100
TOTAL PAID: $4,600  [✓ PAID IN FULL]   ← green chip next to value
Vehicle Deposits:  -$800
```

**Paid tab (multi-vehicle)**
```
Total Labor:    $4,726
Cloning:          $340
Programming:      $300
Add Key:          $130
All Keys Lost:    $200
Total Parts:      $845
TOTAL PAID: $6,541  [✓ PAID IN FULL]
```

### Deliverable
- One file changed: `src/components/ClientCostBreakdown.tsx`
- Screenshot confirmation of the three tab label states
- Confirmation that the duplicate "PAID IN FULL $X" row no longer renders anywhere
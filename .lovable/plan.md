## Problem

On the client portal's **Paid** tab, the totals card still shows "Vehicle Deposits", "Client Deposit", and a big orange "BALANCE DUE" row, plus the per-vehicle "Deposit / Balance due" lines. When everything is paid, these labels are misleading — there is nothing due.

## Fix (UI only, `src/components/ClientCostBreakdown.tsx`)

When `filter === 'paid'`:

1. **Per-vehicle subtotal block (lines 383–388)**: skip the `Deposit:` and `Balance due:` rows entirely. The "Vehicle total" row stays.
2. **Grand total card (lines 412–424)**: skip the `Vehicle Deposits`, `Client Deposit`, and `BALANCE DUE` rows. Replace with a single green row:
   ```
   PAID IN FULL          $X,XXX
   ```
   styled with `text-emerald-600` matching the existing paid-tab GRAND TOTAL color.
3. The GRAND TOTAL row already turns green on the paid tab — keep as-is.

No changes to billing logic, totals math, or other tabs (pending / billed remain unchanged).

## Verification

- Open a client portal → **Paid** tab → confirm no "Balance due" / "Deposit" rows; shows "PAID IN FULL".
- **Pending** and **Billed** tabs still show deposits and balance due as before.
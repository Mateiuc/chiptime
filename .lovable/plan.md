## Problem

In the previous fix, the **Paid** tab hides all deposit info and shows only "PAID IN FULL". The user wants the deposit history preserved — the client paid a deposit before, that fact must still be visible. We just shouldn't show "Balance due" / "Amount due" since nothing is owed.

## Fix (UI only, `src/components/ClientCostBreakdown.tsx`)

When `filter === 'paid'`:

### 1. Per-vehicle subtotal block (lines 383–388)
Replace the conditional. On Paid tab:
- Keep the `Deposit:` line (in muted/neutral color, not destructive red — it's history, not money owed)
- Replace `Balance due:` with `Paid:` showing the same amount (in green) — represents what the client paid after the deposit
- On non-paid tabs: behavior unchanged (red Deposit, orange Balance due)

### 2. Grand total card (lines 412–426)
Replace the `filter === 'paid' ? <PAID IN FULL> : <deposits + BALANCE DUE>` ternary with a unified block that always shows deposits when present, but swaps the final row label:
- Always show `Vehicle Deposits:` and `Client Deposit:` rows when > 0 (muted color on Paid tab, destructive on others)
- Final row:
  - Paid tab → `PAID IN FULL` in green, amount = `grandTotal` (or `grandTotal - totalDeposits` representing the post-deposit payment — see Q below)
  - Other tabs → `BALANCE DUE` in orange, amount = `max(0, grandTotal - totalDeposits)`

### 3. Header per-vehicle amount (lines 259–270)
Currently when `deposit > 0` it shows orange `balanceDue`. On the Paid tab this is misleading (shows $0 or wrong color). Change so on Paid tab it always shows `vehicleTotal` in green, regardless of deposit.

## Open question

On Paid tab, should "PAID IN FULL" show:
- (A) The full `grandTotal` (total work value, including what was covered by deposit), or
- (B) `grandTotal - totalDeposits` (only the amount paid after the deposit)?

Most natural interpretation: show **grandTotal** (full amount paid in total, deposit included), with the deposit row above documenting how it was split. Will go with (A) unless you say otherwise.

## Verification

- **Paid** tab: Deposit rows visible (neutral color), no "Balance due" label, final row says "PAID IN FULL" in green.
- **Pending** / **Billed** tabs: unchanged — red Deposit, orange Balance due.
- Vehicle header on Paid tab shows green total, not orange balance.

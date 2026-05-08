## Issue

In the **Paid Tasks** dialog, Valy Ilasca's MERCEDES card shows `Due $4,391` instead of `Cost $5,191` (paid in green). Lance Naidoo's card next to it correctly shows `Cost $765`.

## Root cause

`src/components/TaskCard.tsx` line **1460-1461** (the 3-column header row: Total / Sessions / Due-or-Cost) only checks `vehicle?.prepaidAmount > 0` to decide between "Due" and "Cost". It never checks `task.status === 'paid'`.

So any paid task whose vehicle has a deposit (Valy Ilasca: $800 deposit) keeps showing "Due: $5,186 − $800 = $4,391". Lance Naidoo has no deposit on that vehicle, so it falls into the "Cost" branch and looks fine.

The collapsed Cost Summary (lines 1604–1616) was already fixed earlier; only this header row was missed.

## Fix

`src/components/TaskCard.tsx` lines 1459-1462:

- If `task.status === 'paid'` → label = `Cost`, value = `totalCost` (full amount), styled emerald-green (matches "Paid:" line in details and the green totals elsewhere).
- Else if `vehicle?.prepaidAmount > 0` → label = `Due`, value = `max(0, totalCost - prepaidAmount)` (current behavior, primary color).
- Else → label = `Cost`, value = `totalCost` (current behavior).

This mirrors the rule used everywhere else: drive paid styling off `task.status`, not off the presence of a deposit.

## Verification

1. Open **Settings → View Paid Tasks**.
2. Valy Ilasca's MERCEDES card now shows `Cost $5,186` in green (no "Due").
3. Lance Naidoo's BMW unchanged: `Cost $765`.
4. On the **All / Active / Billed** tabs, an unpaid task with a deposit still shows `Due $X` in primary color.
5. Expanded "Details" still shows muted "Deposit: -$800" + green "Paid: $5,186" (already correct).

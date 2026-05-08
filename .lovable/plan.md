## Problem

On the desktop dashboard, the **Paid** tab still shows "Due:" / "Balance Due:" labels and uses orange/red colors when a client has a deposit. The mobile portal was fixed (paid = green "PAID IN FULL", deposit kept as muted history). Desktop needs the same treatment in 4 spots in `src/pages/DesktopDashboard.tsx`.

## Fix (UI only, `src/pages/DesktopDashboard.tsx`)

When `filter === 'paid'`, treat deposits as historical (muted, no "Due" label) and show full amounts in green.

### 1. Sidebar client list (lines ~1234–1244)
Currently: if `clientDeposits > 0`, shows orange `Due: {balanceDue}` regardless of filter.
Change: on Paid tab, always show `clientRevenue` in emerald (ignore deposit-orange branch).

### 2. Overview client cards (lines ~1276–1296)
Currently: if deposits > 0, the big total turns orange and shows red `Deposit: -X` + orange `Due: Y`.
Change: on Paid tab → big total stays emerald; deposit row shown as muted `Deposit: -X` (using `text-muted-foreground`); no "Due:" row.
Other tabs unchanged.

### 3. Client header totals row (lines ~1542–1554)
Currently always shows red `Car Deposits` / `Client Deposit` and orange `Due:`.
Change: on Paid tab → show deposits in muted color, hide the `Due:` span entirely. Other tabs unchanged.

### 4. Vehicle header amount block (lines ~1597–1614)
Currently when deposit > 0: red `Deposit: $X` + orange `Balance Due: $Y` (or green "Paid" if fully covered).
Change: on Paid tab → show muted `Deposit: $X` and emerald `Paid` (no "Balance Due" label). Vehicle cost on the left already turns emerald via existing `filter==='paid'` branch.
Other tabs unchanged.

## Verification

- Switch to **Paid** tab on desktop with a client who paid a deposit:
  - Sidebar: client total green, no "Due:".
  - Overview card: green total, muted "Deposit: -$X", no "Due:" row.
  - Expanded client header: green total, muted deposit lines, no "Due:".
  - Vehicle header: green vehicle cost, muted "Deposit: $X", green "Paid" (no "Balance Due").
- **Pending / Billed / Active** tabs unchanged (red deposit, orange Due/Balance Due).

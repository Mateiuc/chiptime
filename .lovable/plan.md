

# Fix: Client Deposit Should Not Appear on Each Vehicle

## Problem
The client-level deposit (`client.prepaidAmount`) is currently **added to every vehicle row**, making it look like each car has a $1,000 deposit (as seen in the screenshot). The client deposit should be a **single, separate concept** from per-vehicle deposits:

- **Vehicle deposit** (`vehicle.prepaidAmount`): shown per vehicle
- **Client deposit** (`client.prepaidAmount`): shown ONCE at the client level, subtracted from the grand total across all vehicles

## Changes

### 1. Vehicle rows — show only vehicle deposit, not client deposit

**`DesktopDashboard.tsx`** (line 1491-1499 — vehicle header in sidebar):
- Change `(vehicle.prepaidAmount || 0) + (client.prepaidAmount || 0)` → `(vehicle.prepaidAmount || 0)` only
- Vehicle rows show only their own deposit

**`TaskCard.tsx`** (mobile task card header ~line 1402-1406, detail section ~line 1546-1550):
- Same: remove `client?.prepaidAmount` from per-vehicle deposit display
- Show only `vehicle?.prepaidAmount`

### 2. Client-level summary — show client deposit separately

**`DesktopDashboard.tsx`** (sidebar client list ~line 1152, overview cards ~line 1196):
- Keep the combined calculation here (vehicle deposits + client deposit) — this is the correct place for it
- Add a separate "Client Deposit" line in the overview card when `client.prepaidAmount > 0`

### 3. Bill PDFs — per-vehicle bill shows only vehicle deposit

**`DesktopDashboard.tsx`** (desktop bill ~line 393):
- Change `(vehicle.prepaidAmount || 0) + (client.prepaidAmount || 0)` → `(vehicle.prepaidAmount || 0)` only

**`TaskCard.tsx`** (mobile bill ~line 487, share bill ~line 656/672, preview ~line 859):
- Same: use only `vehicle?.prepaidAmount` for per-vehicle bills

### 4. Client Report PDFs — show client deposit as separate line

**`DesktopDashboard.tsx`** (~line 871), **`DesktopClientsView.tsx`** (~line 168), **`ManageClientsDialog.tsx`** (~line 302):
- Keep grand total calculation combining both
- Add a separate "Client Deposit" line item before the vehicle deposit sum, so it's clear what's client-level vs vehicle-level

### 5. Client Portal — `ClientCostBreakdown.tsx` (~line 466)
- Grand total section: show client deposit as a separate labeled line ("Client Deposit") distinct from vehicle deposits
- Keep the combined total for Balance Due calculation

### 6. Share bill metadata — `TaskCard.tsx` (~line 1048, 1080)
- Remove `client?.prepaidAmount` from per-vehicle `totalAmount` calculation — use only vehicle deposit

## Summary
- Per-vehicle displays/bills: only `vehicle.prepaidAmount`
- Client-level summaries/reports: `client.prepaidAmount` shown as its own line, combined with vehicle deposits for Balance Due
- ~4 files, ~15 locations updated


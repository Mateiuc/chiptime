

# Add "Deposit" Tracking Everywhere

## Terminology
The professional term in auto mechanics for prepaid amounts is **"Deposit"** (sometimes "Deposit Received"). All references to "Prepaid" will be renamed to "Deposit" and the remaining amount will show as **"Balance Due"**.

## Places that need updates

### 1. Rename "Prepaid" → "Deposit" and "Remaining" → "Balance Due" everywhere

**`src/pages/DesktopDashboard.tsx`**:
- Vehicle header display: `Prepaid:` → `Deposit:`, `Remaining:` → `Balance Due:`
- Inline edit placeholder: `Prepaid $` → `Deposit $`
- Bill PDF: `Prepaid:` → `Deposit:`, `Subtotal` label stays, TOTAL shows "Balance Due"

**`src/components/EditVehicleDialog.tsx`**:
- Label: `Prepaid Amount` → `Deposit`

### 2. Add deposit/balance to **Client Report PDF** (the missing one)

**`src/pages/DesktopDashboard.tsx`** — `generateClientPDF` function (~line 830):
- Per-vehicle section: after `Total:`, add `Deposit:` and `Balance Due:` lines if vehicle has a deposit
- Client summary section: sum all vehicle deposits, show total deposits and total balance due after Grand Total

**`src/components/DesktopClientsView.tsx`** — `generateClientPDF` function (~line 138):
- Same changes: per-vehicle deposit/balance lines, and client-level totals

### 3. Add deposit/balance to **Client Portal** (ClientCostBreakdown)

**`src/lib/clientPortalUtils.ts`**:
- Include `prepaidAmount` in `VehicleCostSummary` (from the vehicle object)
- Include it in slim wire format for portal sync

**`src/components/ClientCostBreakdown.tsx`**:
- Per-vehicle card: after "Vehicle Total", show `Deposit` (red) and `Balance Due` if deposit exists
- Grand Total card: sum all deposits, show `Total Deposits` and `Balance Due` after Grand Total

### 4. Dashboard vehicle header display already works — just rename labels

## Technical Detail
- No type changes needed (`prepaidAmount` already exists on `Vehicle`)
- Balance calculation: `Balance Due = max(0, vehicleTotal - deposit)`
- Total client deposit: `sum of all vehicle.prepaidAmount`


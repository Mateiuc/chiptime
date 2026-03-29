

# Add Financial Summary to Client Header (All Status Views)

## Problem
The client header card (pink banner) currently only shows phone number and hourly rate. The user wants to see **Total**, **Due**, **Vehicle Deposits**, and **Client Deposit** right after the phone number — visible in Active, Completed, Billed, and Paid views.

## Change — `src/pages/DesktopDashboard.tsx` (line ~1352-1356)

After the phone + rate line in the client header card, add a second row showing financial summary:

```
Total: $1,789.60 | Due: $789.60 | Car Deposits: $500 | Client Deposit: $500
```

### Logic
```typescript
const clientRevenue = clientVehicles.flatMap(v => v.tasks).reduce((sum, t) => sum + getTaskCost(t), 0);
const vehicleDeposits = clientVehicles.reduce((sum, cv) => sum + (cv.vehicle?.prepaidAmount || 0), 0);
const clientDeposit = client.prepaidAmount || 0;
const totalDeposits = vehicleDeposits + clientDeposit;
const balanceDue = Math.max(0, clientRevenue - totalDeposits);
```

### Display rules
- **Total** — always shown if > 0 (green)
- **Due** — shown if deposits exist and balance > 0 (orange/bold)
- **Car Deposits** — shown only if vehicleDeposits > 0 (red)
- **Client Deposit** — shown only if clientDeposit > 0 (red)

### Implementation
Add a new `<div>` row below the existing phone/rate line (~line 1356), using the same `text-sm` styling with colored badges for each financial item.

## File
- `src/pages/DesktopDashboard.tsx` — ~10 lines added at line 1356


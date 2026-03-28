

# Client-Level Deposit in Bill PDFs — Already Covered

The approved plan **already includes** bill PDF updates. Here's exactly what will change in each PDF generation point:

## Bill PDFs (per-vehicle bills)

### `DesktopDashboard.tsx` (desktop bill, ~line 391)
Currently: `const prepaid = vehicle.prepaidAmount || 0;`
Updated: `const prepaid = (vehicle.prepaidAmount || 0) + (client.prepaidAmount || 0);`

### `TaskCard.tsx` (mobile bill, ~line 487)
Currently: `const deposit = vehicle?.prepaidAmount || 0;`
Updated: `const deposit = (vehicle?.prepaidAmount || 0) + (client?.prepaidAmount || 0);`

Also updates the share bill (~line 656, 672) and preview bill (~line 859) in the same file.

## Client Report PDFs

### `DesktopDashboard.tsx` (~line 871) & `DesktopClientsView.tsx` (~line 168)
Grand total deposits sum updated to include `client.prepaidAmount`.

## No plan changes needed
All bill/PDF generation is already part of the approved plan under "Deposit Calculation Updates." Ready to implement as-is.


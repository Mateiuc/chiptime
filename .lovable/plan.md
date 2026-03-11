

# Redesign Invoice Page — Generic Invoice, Not Auto-Specific

## Problem
The invoice page is hardcoded for automotive work (vehicle year/make/model/VIN fields, cloning/programming extras). The user wants a **general-purpose invoice creator** where:
1. No vehicle-specific fields — just client info (name, email, phone, address)
2. Line items have independent fields: description, time, and amount are **not required together** — any combination works
3. Only fields with actual data appear on the invoice/PDF
4. A proper invoice with invoice number, due date, notes, etc.

## Changes in `src/components/DesktopInvoiceView.tsx`

### Remove
- Vehicle fields (year, make, model, VIN) and `vehicleInfo` memo
- Billing extras section (min hour, cloning, programming) and all related state
- Vehicle line in PDF and preview

### Replace Client Section With
- Name, Email, Phone, Address (all optional, only filled ones appear on PDF)

### Add Standard Invoice Fields
- Invoice Number (auto-generated or manual)
- Due Date (optional)
- Notes / Terms (optional textarea at bottom)

### Fix Line Item Logic
- Each line item has description, time, amount — all independent and optional
- A line item appears on the invoice if **any** of its 3 fields has data (not empty description + not "00:00" time + not 0 amount)
- In PDF: only render the field columns that have values for that row

### Update PDF Generation
- After "To:" show client name, then email/phone/address only if filled
- Remove vehicle info line
- Remove billing extras (cloning, programming, min hour)
- Line items: render each field only if it has a value
- Keep parts section as-is

### Update Live Preview
- Mirror the same conditional logic — show only filled client fields, skip empty line item columns


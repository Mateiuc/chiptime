

# Redesign Invoice Page — Standalone (No Client Lookup)

## What Changes

The invoice page currently ties into the app's client/vehicle/task system. The user wants it to be a **standalone invoice creator** — type in client info directly, no dropdowns.

### Changes in `src/components/DesktopInvoiceView.tsx`:

**1. Replace client/vehicle/task selectors with manual input fields:**
- Remove: client Select, vehicle Select, pre-fill from task Select, all related state (`selectedClientId`, `selectedVehicleId`, `selectedTaskId`, `handlePrefillTask`)
- Remove props dependency on `clients`, `vehicles`, `tasks` (keep `settings` for rates)
- Add free-text fields: Client Name, Email, Phone, Vehicle Year, Make, Model, VIN

**2. Make description field multi-line:**
- Change line item description from `<Input>` to `<Textarea>` (already exists at `src/components/ui/textarea.tsx`)
- Use a small min-height textarea per line item

**3. Skip empty line items in PDF:**
- Already partially done (checks `!li.description && li.amount === 0`)
- Strengthen: only render line items where **both** time is not "00:00" **and** amount > 0 (or at least one has a value)
- Same logic for the live preview — hide rows with no time and no amount

**4. Update PDF save filename** to use the typed client name instead of `client?.name`

**5. Update live preview** to show typed-in client name and vehicle info instead of looked-up values

### Props change in `DesktopDashboard.tsx`:
- Simplify props passed to `<DesktopInvoiceView>` — only `settings` needed (remove `clients`, `vehicles`, `tasks`)


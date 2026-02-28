

# Add Client/Vehicle Editing and More Task Actions to Desktop Dashboard

## What's Missing
The desktop tree view currently only has: Edit task, Mark Billed (completed only), Mark Paid (billed only), Delete task, Move vehicle, Delete vehicle/client. 

Missing compared to mobile:
- **Client editing** (name, email, phone, rate) — inline edit form
- **Vehicle editing** (VIN, make, model, year, color) — open EditVehicleDialog
- **Add Client / Add Vehicle** buttons
- **Task actions for billed/paid**: Generate Bill PDF, Print Detail PDF, Client Portal link
- **Client actions**: Print PDF, Set PIN, Portal, Share portal link

## Changes — `src/pages/DesktopDashboard.tsx`

### 1. Add state for dialogs and inline editing
- Import `AddClientDialog`, `AddVehicleDialog`, `EditVehicleDialog`
- Add state: `editingClientId`, `editFormData`, `showAddClient`, `showAddVehicle`, `addVehicleClientId`, `editingVehicle`
- Add client inline edit handlers (startEdit, saveEdit, cancelEdit)

### 2. Header — Add "Add Client" button
- Next to search bar, add a `+ Client` button that opens `AddClientDialog`

### 3. Client header — Add Edit + PDF + Portal + Add Vehicle buttons
- **Edit**: Toggles inline edit form (name/email/phone/rate) below the client gradient header
- **PDF**: Generates client PDF (reuse logic from ManageClientsDialog or call jsPDF directly)
- **Portal**: Navigate to `/client/${client.id}`
- **Add Vehicle**: Opens `AddVehicleDialog` pre-set for this client

### 4. Vehicle header — Add Edit button
- **Edit**: Opens `EditVehicleDialog` with all fields (VIN, make, model, year, color, VIN scanner)

### 5. Task action buttons — Expand for all statuses
Currently only shows: Edit, Mark Billed (completed), Mark Paid (billed), Delete.

Add based on status:
- **completed**: + "Preview Bill" (PDF), "Generate Bill & Mark Billed" (PDF + status change)
- **billed**: + "Bill" (re-generate PDF), "Print Detail" (detail PDF), keep Mark Paid and Delete
- **paid**: + "Print Detail" (detail PDF), keep Delete
- All statuses: + "Client Portal" link if client exists

### 6. Inline client edit form
When editing a client, replace the info line (email/phone/rate) with input fields (w-64 each, not stretched), plus Save/Cancel buttons. Same pattern as ManageClientsDialog but horizontal for desktop.

## Files changed
- `src/pages/DesktopDashboard.tsx` — add imports, state, handlers, edit forms, action buttons, dialogs


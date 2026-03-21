

# Add Extended Client Fields (Address, ITIN, etc.)

## What changes

Add new optional fields to the Client type — address, city, state, zip, ITIN, company name, and notes. Update the desktop "Edit Client" form and the "Add Client" dialog to include all fields. In the client info display, only show fields that have values.

## Files to change

### 1. `src/types/index.ts` — Add new fields to Client interface
New optional fields:
- `address?: string`
- `city?: string`
- `state?: string`
- `zip?: string`
- `itin?: string` (Individual Taxpayer Identification Number)
- `companyName?: string`
- `notes?: string`

### 2. `src/components/DesktopClientsView.tsx`

**Edit Client form (lines 246-256)**: Add input fields for all new fields in the grid layout.

**Client info display (lines 292-297)**: Add conditional rendering for each new field — only shown when filled. Example: company name, address block, ITIN with a subtle icon.

### 3. `src/components/AddClientDialog.tsx`

Add the same new fields to the mobile/shared "Add Client" dialog form, following the existing pattern of state variables and inputs.

### 4. `src/components/ManageClientsDialog.tsx`

Check if it has its own edit form and add the new fields there too if needed.


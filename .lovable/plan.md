

# Add Address Next to Business Name on Bill PDF

## What changes

When a client has a `companyName`, append the address on the same line (e.g., "Acme Corp - 123 Main St, City, ST 12345"). Only when `companyName` exists and address fields are present.

## Files to change (3 locations)

### 1. `src/components/TaskCard.tsx` (line 339)
Build a display string: if `companyName` exists and address fields exist, append them on the same line separated by " - ". Example: `"Acme Corp - 123 Main St, Miami, FL 33101"`

### 2. `src/components/TaskCard.tsx` (line 700)
Same change for the second bill generation function (non-stripDiacritics version).

### 3. `src/pages/DesktopDashboard.tsx` (line 279)
Same change for the desktop bill generation.

### Logic (all 3 locations)
```typescript
let clientLine = client?.companyName || client?.name || 'N/A';
if (client?.companyName) {
  const addrParts = [client.address, client.city, client.state, client.zip].filter(Boolean);
  if (addrParts.length > 0) {
    clientLine = `${client.companyName} - ${addrParts.join(', ')}`;
  }
}
doc.text(stripDiacritics(clientLine), 20, 53);
```


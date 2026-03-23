

# Fix: Export/Import Missing Vehicle & Client Fields

## Problem
The XML export/import in `src/lib/xmlConverter.ts` is missing critical fields — most importantly `prepaidAmount` (deposit) on vehicles, but also many other client and vehicle fields that were added after the original export was written.

## Missing Fields

**Vehicle** (line 39-48 export, line 197-207 import):
- `prepaidAmount` (deposit) — **the reported bug**
- `diagnosticPdfUrl`

**Client** (line 25-34 export, line 182-192 import):
- `address`, `city`, `state`, `zip`
- `companyName`, `itin`
- `notes`
- `cloningRate`, `programmingRate`, `addKeyRate`, `allKeysLostRate`
- `accessCode`, `portalId`

## Changes — `src/lib/xmlConverter.ts`

### 1. Export — Vehicle section (lines 39-49)
Add the missing attributes to the Vehicle XML element:
- `if (vehicle.prepaidAmount) xml += \`prepaidAmount="..."\``
- `if (vehicle.diagnosticPdfUrl) xml += \`diagnosticPdfUrl="..."\``

### 2. Export — Client section (lines 25-34)
Add all missing client attributes:
- `address`, `city`, `state`, `zip`, `companyName`, `itin`, `notes`
- `cloningRate`, `programmingRate`, `addKeyRate`, `allKeysLostRate`
- `accessCode`, `portalId`

### 3. Import — Vehicle parsing (lines 197-207)
Parse the new attributes when reading XML:
- `prepaidAmount`: `parseFloat()` if present
- `diagnosticPdfUrl`: string if present

### 4. Import — Client parsing (lines 182-192)
Parse all the new client attributes when reading XML, using appropriate types (string for text fields, `parseFloat` for rates).

### 5. Export — Settings section (lines 132-135)
Check if settings also has additional rate fields that need exporting (likely already covered by the client-level rates, but worth verifying during implementation).

All changes are in one file: `src/lib/xmlConverter.ts`.


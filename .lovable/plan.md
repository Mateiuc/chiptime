

# Show All Client Rates (Including Defaults)

## Problem
Currently, rates like cloning, programming, add-key, and AKL only display in the client info panel when the client has a custom override set. If they're using the default rate from settings, nothing shows — making it look like they have no rate configured.

## Solution
Always show all five rates in the client detail header. Use the client's custom rate if set, otherwise fall back to the global default. No conditional rendering — always display all rate lines.

## Changes

### `src/components/DesktopClientsView.tsx` (lines 310-318)
Replace the conditional rate display with always-visible rates using fallbacks:

```
<div className="flex items-center gap-1.5">
  <DollarSign .../> {selectedClient.hourlyRate || settings.defaultHourlyRate || 0}/hr
</div>
<div className="flex items-center gap-1.5">
  <DollarSign .../> {selectedClient.cloningRate || settings.defaultCloningRate || 0} /clone
</div>
<div className="flex items-center gap-1.5">
  <DollarSign .../> {selectedClient.programmingRate || settings.defaultProgrammingRate || 0} /prog
</div>
<div className="flex items-center gap-1.5">
  <DollarSign .../> {selectedClient.addKeyRate || settings.defaultAddKeyRate || 0} /add-key
</div>
<div className="flex items-center gap-1.5">
  <DollarSign .../> {selectedClient.allKeysLostRate || settings.defaultAllKeysLostRate || 0} /AKL
</div>
```

All five rates always visible, falling back to settings defaults when no client override exists.

## Files to Change
1. `src/components/DesktopClientsView.tsx` — remove conditional rendering on rate lines, add settings fallbacks


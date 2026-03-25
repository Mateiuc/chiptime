

# Add Clipboard Copy When Clicking PIN Button

## Problem
Clicking the PIN/KeyRound button on any page only shows a toast with the PIN but doesn't copy it to clipboard. The user wants the PIN automatically copied when clicked.

## Changes

### 3 locations — all same pattern

Add `navigator.clipboard.writeText(accessCode)` before the toast in each PIN button handler:

**1. `src/components/DesktopClientsView.tsx` (line 292-293)**
When `selectedClient.accessCode` exists, copy it to clipboard and update toast to confirm copy.

**2. `src/components/ManageClientsDialog.tsx` (line 680-681)**
Same fix for the client list PIN button.

**3. `src/pages/DesktopDashboard.tsx` (line 1384-1385)**
Same fix for the sidebar client list PIN button.

In all 3 spots, both the "already has code" and "just generated code" branches get the copy. Toast changes from `'Access Code'` to `'PIN Copied!'`.

```typescript
// Pattern applied in all 3 locations:
if (client.accessCode) {
  navigator.clipboard.writeText(client.accessCode);
  toast({ title: 'PIN Copied!', description: `PIN: ${client.accessCode}` });
} else {
  // ... sync, then:
  navigator.clipboard.writeText(result.accessCode);
  toast({ title: 'PIN Copied!', description: `PIN: ${result.accessCode}` });
}
```


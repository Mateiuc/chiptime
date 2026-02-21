

## Add Billed/Paid Tabs Per Client + Remove Header Transparency

### Changes

**File: `src/components/ManageClientsDialog.tsx`**

1. **Remove header transparency**: Change the header from `bg-purple-500/10 backdrop-blur-sm` to a solid background like `bg-purple-500/20` (remove `backdrop-blur-sm` and increase opacity).

2. **Add per-client tab navigation**: Inside each client's `AccordionContent`, after the client info/actions section, add a simple tab bar with three options: **Info** (default, current content), **Billed**, and **Paid**.

3. **Track active tab per client**: Add state `clientTab: Record<string, 'info' | 'billed' | 'paid'>` to track which tab is selected for each client.

4. **Billed tab content**: Filter tasks for that client with `status === 'billed'`, display them using `TaskCard` (same pattern as SettingsDialog's billed view), grouped by vehicle.

5. **Paid tab content**: Same as billed but filtering `status === 'paid'`.

6. **Tab styling**: Simple horizontal button group at the top of each client's expanded section -- solid background buttons, active tab highlighted with primary color.

### Technical Details

| File | Change |
|------|--------|
| `src/components/ManageClientsDialog.tsx` | Add `clientTab` state, import `TaskCard` + `getVehicleColorScheme`, add tab bar UI inside each client accordion, render billed/paid task lists, remove header transparency |

New imports needed:
- `TaskCard` from `./TaskCard`
- Already has `getVehicleColorScheme` imported

The billed/paid views will show tasks with vehicle name, time, cost, and parts -- reusing the existing `TaskCard` component for consistency with the rest of the app.

## Changes

### 1. Reorder tabs — Schedule after Completed
File: `src/pages/Index.tsx` (mobile)
- In the Tabs section (lines ~743–766), reorder the `<TabsTrigger>`s to: **Active → Completed → Schedule**, and move the `<TabsContent value="schedule">` block accordingly. Set `defaultValue="active"` (already is).

Desktop (`DesktopDashboard.tsx`) uses a sidebar nav, not tabs. Reorder the sidebar nav items so Schedule sits after the equivalent "completed/tree" item (find the nav items array and move the `schedule` entry to follow the active/completed cluster).

### 2. Replace VIN scan icon with QrCode + "VIN" label
File: `src/components/ScheduleView.tsx`
- Replace the `Scan` lucide import with `QrCode`.
- Change the icon-only button into a small pill button:
  - `<Button size="sm" className="h-7 px-2 gap-1 ...">` with `<QrCode className="h-3.5 w-3.5" />` + `<span className="text-[11px] font-semibold">VIN</span>`.
  - Keep the pulsing amber variant when the vehicle has no VIN; ghost/outline when re-scanning an existing VIN.
  - Keep tooltip/title: "Scan VIN now" / "Re-scan VIN".

No behavior changes — same `setScanForVehicleId(vehicle.id)` onClick, same `VinScanner` flow.

## Out of scope
- No changes to the VIN scanner itself.
- No changes to the new-vehicle inline form.

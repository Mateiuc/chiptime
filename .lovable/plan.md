Add an inline "+ New vehicle" option to the Vehicle picker in the Schedule entry dialog, so a worker can create a car without leaving the page.

## Behavior

- Vehicle dropdown gains a top entry **+ Add new vehicle** (only enabled once a Client is selected).
- Choosing it opens a compact inline sub-form right under the dropdown (same dialog, no second modal) with fields: **VIN** (with "Scan VIN" button), **Make**, **Model**, **Year**, **Color**.
- VIN auto-decode (17 chars) fills Make/Model/Year, same as `AddVehicleDialog`.
- **Save vehicle** button creates the `Vehicle` via `addVehicle()`, auto-selects it as the schedule entry's vehicle, and collapses the sub-form.
- Cancel link closes the sub-form without saving.
- Duplicate-VIN check against active tasks (same rule as `AddVehicleDialog`).

## Technical notes

- `ScheduleEntryDialog` gains new props: `tasks: Task[]`, `settings: Settings`, `onAddVehicle: (v: Vehicle) => Promise<void> | void`.
- `ScheduleView` wires them from `useTasks`, `useSettings`, and `useVehicles().addVehicle`. After save it appends the new vehicle to its own `vehicles` array reference (the hook already updates global state) and passes the new id back.
- Reuse the existing `VinScanner` component for the camera flow.
- No schema/migration changes. No changes to `AddVehicleDialog` itself.

## Files touched

- `src/components/ScheduleEntryDialog.tsx` — add inline new-vehicle sub-form + props.
- `src/components/ScheduleView.tsx` — pass `tasks`, `settings`, `addVehicle` into the dialog.

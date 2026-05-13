## Goal
Add collapse/expand to the per-client groups in **Settings → View Billed Tasks** and **Settings → View Paid Tasks** so long lists are easier to navigate.

## Current behavior
Each view (`SettingsDialog.tsx` lines 602–698) renders one card per client with the client name + total in a header bar, followed by all of that client's task cards always expanded. With many clients/tasks the list becomes very long.

## Proposed change (UI only, in `src/components/SettingsDialog.tsx`)

1. Add a single state for tracking collapsed groups, scoped per view:
   ```ts
   const [collapsedBilledClients, setCollapsedBilledClients] = useState<Set<string>>(new Set());
   const [collapsedPaidClients, setCollapsedPaidClients] = useState<Set<string>>(new Set());
   ```
   Default: **all collapsed** when opening either view (initialize from the keys of `billedTasksByClient` / `paidTasksByClient` via a `useEffect` keyed on the dialog opening or the keys changing). This gives an immediate overview of clients + totals; user taps to expand the one they want.

2. Convert the existing client-group header (the `<div>` with the name + total badge) into a `<button>` that toggles that client's id in the corresponding Set. Add a chevron icon on the right (`ChevronDown` when collapsed, `ChevronUp` when expanded), reusing the same lucide-react icons already imported elsewhere.

3. Conditionally render the inner `<div className="p-2 space-y-2">…task cards…</div>` only when the client id is **not** in the collapsed Set.

4. Add a small toolbar above each list with task count + an "Expand all / Collapse all" button (same pattern used in `ClientCostBreakdown.tsx` lines 244–254 for visual consistency).

5. Keep the existing colors, borders, badges, and spacing — no other styling changes.

## Out of scope
- No changes to client portal, PDF, mobile task list, or data layer.
- No changes to `TaskCard` itself.
- No persistence of collapsed state across dialog open/close (in-memory only).

## Verification
- Open Settings → View Billed Tasks: see all client cards collapsed showing just name + total + chevron.
- Tap a header → tasks expand; tap again → collapse.
- "Expand all" / "Collapse all" toggles every group at once.
- Same behavior on the Paid Tasks view.
- Empty-state messages ("No billed tasks yet." / "No paid tasks yet.") unchanged.

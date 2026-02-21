

## Add Tabs to Client Portal: Pending, Billed, Paid

Add a fixed top tab menu to the client portal that filters sessions by status, with a solid (non-transparent) header.

### Tab Definitions

| Tab | Sessions Shown |
|-----|---------------|
| Pending | Sessions with status: `pending`, `in-progress`, `paused`, `completed` |
| Billed | Sessions with status: `billed` |
| Paid | Sessions with status: `paid` |

### Changes

**File: `src/pages/ClientPortal.tsx`**
- Import `Tabs`, `TabsList`, `TabsTrigger` from `@/components/ui/tabs`
- Add `activeTab` state defaulting to `'pending'`
- Replace header background from `bg-primary/10` to solid `bg-card border-b-2 border-border` (both PIN screen and cost breakdown views)
- Add a tab bar inside the sticky header with three triggers: Pending, Billed, Paid
- Pass `activeTab` as a `filter` prop to `ClientCostBreakdown`

**File: `src/components/ClientCostBreakdown.tsx`**
- Accept a new optional `filter` prop: `'pending' | 'billed' | 'paid'`
- Filter each vehicle's sessions based on the active tab:
  - `pending` matches statuses: `pending`, `in-progress`, `paused`, `completed`
  - `billed` matches status: `billed`
  - `paid` matches status: `paid`
- Recalculate vehicle subtotals and grand totals from filtered sessions only
- Hide vehicles with zero matching sessions
- Show an empty state message per tab if no sessions match (e.g., "No pending work found.")

### Technical Details

Filtering logic applied before rendering:

```text
const statusMap = {
  pending: ['pending', 'in-progress', 'paused', 'completed'],
  billed:  ['billed'],
  paid:    ['paid'],
};
```

Each vehicle's sessions are filtered, then labor/parts/totals are recalculated from the filtered set. Vehicles with no matching sessions are excluded from the view. The grand total card reflects only the active tab's data.


## Phase 3 — Cost/Due label fix

### Audit results

The "Cost / Due" toggle exists at exactly **one** site in the entire codebase:

- **`src/components/TaskCard.tsx` L1534** — the per-task summary stat cell on the mobile task card (also rendered on desktop's task list since the same component is reused).

Other surfaces use different language and do not need changes:

| Surface | Current label | Verdict |
|---|---|---|
| `DesktopDashboard.tsx` desktop task row (~L1781) | no label, just `formatCurrency(cost)` | nothing to change |
| `DesktopDashboard.tsx` vehicle/client header (L1282, L1336, L1602, L1677) | "Due:" / "Balance Due:" — already conditional on balance > 0 and not paid | already correct |
| `ClientCostBreakdown.tsx` portal vehicle subtotal (L406) | "Balance due:" only when deposit > 0 | per-vehicle, not per-task; out of scope (Phase 3 is the per-task label) |
| `TaskCard.tsx` expanded breakdown (L1680, L1690) | "Total:" + "Balance Due:" line that only renders when deposit > 0 | this is a separate breakdown row, not the Cost/Due label; leave as-is |
| Bill PDFs (`TaskCard.tsx` L520/525, L921/926) | "TOTAL:" — never says "Cost" | nothing to change |
| Aggregate PDFs (`DesktopDashboard.tsx`, `DesktopClientsView.tsx`, `ManageClientsDialog.tsx`) | "Balance Due:" only when deposits > 0 | aggregate-level, not per-task Cost/Due; out of scope |

So the change is genuinely a one-liner in TaskCard.

### Change

`src/components/TaskCard.tsx` L1534–L1535:

Before:

```tsx
<div className="text-muted-foreground text-xs font-medium mb-1">
  {task.status !== 'paid' && (vehicle?.prepaidAmount || 0) > 0 ? 'Due' : 'Cost'}
</div>
<div className={...}>
  {formatCurrency(
    task.status !== 'paid' && (vehicle?.prepaidAmount || 0) > 0
      ? Math.max(0, totalCost - (vehicle?.prepaidAmount || 0))
      : totalCost
  )}
</div>
```

After:

```tsx
<div className="text-muted-foreground text-xs font-medium mb-1">
  {task.status === 'paid' ? 'Cost' : 'Due'}
</div>
<div className={...}>
  {formatCurrency(
    task.status === 'paid'
      ? totalCost
      : Math.max(0, totalCost - (vehicle?.prepaidAmount || 0))
  )}
</div>
```

When `prepaidAmount` is 0, `Math.max(0, totalCost - 0) === totalCost`, so the displayed number is unchanged for unpaid-no-deposit tasks — only the label flips from "Cost" to "Due", which is the desired behavior.

### Verification

- Unpaid task, no deposit → label "Due", value = `totalCost`.
- Unpaid task, deposit < total → label "Due", value = `totalCost − deposit` (unchanged).
- Unpaid task, deposit ≥ total → label "Due", value = `$0`.
- Paid task → label "Cost", value = `totalCost` (unchanged).
- Mobile + desktop both reuse `TaskCard`, so both surfaces flip together.
- `/client-view` and PDFs untouched (already correct or use different vocabulary).

### Out of scope

Paid-status validation, min-hour reconciliation, any other behavior changes.

### Deliverable

- One file changed: `src/components/TaskCard.tsx` (label + value expression).
- Confirmation that an unpaid task with no deposit reads "Due: $\<total\>" on TaskCard wherever it's rendered.

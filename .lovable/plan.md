## Reports audit against the new revenue rule

**Revenue rule (single source):** `taskRevenue = max(0, labor + services − vehicleDiscount)` — parts excluded (pass-through).

### Good news — already consistent

Every Reports memo and KPI already routes through `getTaskCost(task)`, so switching that one helper (last turn) propagated the new rule to:

| Surface | Uses `getTaskCost` | Status |
|---|---|---|
| Header KPI "revenue" | totalRevenue (paid-only) | correct |
| Header KPI "Unpaid" | unpaidBalance (billed-only) | correct |
| By-worker chip row | workerTotals.cost | correct |
| Revenue Over Time bars ("Billed") | revenueOverTime, revenueMirror.billed | correct |
| Received bars | revenueMirror.received (minus deposit, plus deposit on `at` month) | correct |
| Revenue by Vehicle (Top 20) | revenueByVehicle | correct |
| Revenue by Client | revenueByClient | correct |
| Detail table "Cost" column + Total | detailData.cost, table totals | correct |
| Drill-down tables | via `toDrillRow` | correct |

Hours, task counts, cars-serviced, tasks-by-status — unaffected by the money rule.

### Small fixes to make it obvious

1. **Legend/label clarity** — today the mirror chart says "Billed (work date)". With parts excluded that's misleading (the invoice "Billed" total DOES include parts). Change labels:
   - Top bars: **"Earned (work date)"** — labor + services − discount, bucketed by `task.createdAt`.
   - Bottom bars: **"Received (paid date)"** — same rule, bucketed by `paidAt`; deposits added on their applied date.
   - Card title stays "Revenue Over Time".
2. **Header KPI wording** — keep "revenue" but add a hover tooltip: *"Paid tasks. Labor + services − discount. Parts excluded (pass-through)."*
3. **"Unpaid" pill** — same tooltip wording, scoped to billed tasks.
4. **New "Parts (pass-through)" chip** in the header stats row — sum of `parts` across filtered tasks, muted style, so you can still see the parts volume without it inflating revenue.
5. **Detail table** — rename column header **"Cost" → "Revenue"** to match the rule, and add a small "Parts" column (right-aligned, muted) so each row shows both numbers.
6. **Drill tables** — same rename ("Cost" → "Revenue"), plus a Parts column, plus the footer total for both.

### Not changing

- Task chip on Desktop Dashboard, invoices, bill PDFs, client portal — still show what the client pays (`labor + services − discount + parts`). Untouched.
- Deposit math, hours, task counts, filters — untouched.
- `src/lib/billing.ts` — untouched.

### Files touched

- `src/components/DesktopReportsView.tsx` — labels, tooltips, header parts chip, table column rename + Parts column, `DrillTable` gets a Parts column.

That's it. The math is already right after last turn; this pass is about making the UI honestly say "revenue excludes parts" and surfacing parts separately so you're not blind to them.

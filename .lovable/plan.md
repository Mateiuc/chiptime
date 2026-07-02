## You're right — parts are $0 revenue

If you pay $100 for a part and bill the client $100, your revenue from that $100 is **$0**. It's a pass-through. Same $100 in, same $100 out.

So the **chip total** (what the client pays) and **your revenue** are different numbers on purpose:

```
Chip total (client pays)   = labor + services − discount + parts
Your revenue (shop earns)  = labor + services − discount
Parts                       = pass-through, $0 profit
```

That means the current Reports formula is almost right, but wrong in one detail. Today it does:
```
taskRevenue = max(0, labor + services − discount) − parts   ← subtracts parts (double penalty)
```
That subtracts parts a second time, which is why numbers look off.

### Fix

Change `getTaskCost` in `src/components/DesktopReportsView.tsx` (lines 178-184) to:

```ts
const getTaskCost = (task: Task) => {
  const client = clients.find(c => c.id === task.clientId) || null;
  const vehicle = vehicles.find(v => v.id === task.vehicleId) || null;
  const vehicleTasks = tasks.filter(t => t.vehicleId === task.vehicleId);
  const a = computeTaskTotalAllocated(task, vehicle, vehicleTasks, client, settings);
  return Math.max(0, a.labor + a.services - a.discount);   // parts excluded, not subtracted
};
```

That's it. Parts drop out completely from every Reports figure.

### Effect on the numbers

- **Total Revenue** (paid-only): sum of `labor + services − discount` across paid tasks. Will be **higher** than today (no more subtracting parts) and **lower** than the chip totals (no adding parts).
- **Received bars**: same, bucketed by `paidAt`. Deposits still counted once on `depositApplied.at`.
- **Unpaid balance** (billed-only): same rule.
- **Revenue by client / vehicle / worker**: same rule.
- **Total hours** and **task count**: unchanged.

### Not changing

- Task chip on the dashboard still shows the full amount the client pays (includes parts). That's correct — client owes it.
- Invoice, bill PDF, client portal, deposit math: untouched. Those are "what the client pays", not "what you earn".
- Imported (XLS) tasks: `importedSalary` acts as labor, no parts to worry about.

Confirm this matches how you think about revenue and I'll apply.

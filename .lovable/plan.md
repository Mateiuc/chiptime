## Diagnosis

Reports' "Received (paid date)" bars are (almost) empty even though many tasks are marked **Paid**. Confirmed against the cloud data:

| workspace | tasks | paid | paid with `paidAt` |
|---|---|---|---|
| default | 52 | 35 | **0** |
| main    | 82 | 53 | **0** |
| others  | 29 | 16 | **0** |

Historical tasks were marked Paid before the `paidAt` timestamp was introduced, so the Reports chart (which filters `t.status === 'paid' && t.paidAt`) discards them and shows nothing under "Received". Same reason the per-worker/vehicle received rollups look thin.

Only paid‑date data is affected. Billed revenue and everything else is intact.

## Fix (small, presentation‑layer only)

In `src/components/DesktopReportsView.tsx`, when computing the "Received" series, fall back to a best‑guess date instead of dropping the task:

`paidDate = t.paidAt ?? lastSessionCompletedAt(t) ?? t.createdAt`

Apply the same fallback anywhere the reports view groups "received" by date (mirror chart today; any future received‑by‑month/worker rollup). No business‑logic change, no schema change, no writes.

### Optional one‑time backfill (ask before doing)

If the user wants historical `paidAt` values persisted (so mobile/desktop agree), we can additionally stamp `paidAt = last session end || createdAt` for every existing `status='paid'` task on the next load. This is a one‑shot migration in `useStorage` / cloud pull, guarded by "only if missing". I'll only do this if asked — the presentation fallback above already fixes the chart.

## Files touched

- `src/components/DesktopReportsView.tsx` — `revenueMirror` memo: replace the `paidAt`‑only filter with the fallback date resolver.

That's the whole change.

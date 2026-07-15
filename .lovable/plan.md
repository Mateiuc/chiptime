## Add "Jobs" — fixed-price line items (desktop edit only)

Introduce a new per-session line-item type called **Jobs** for fixed-price work. Independent of time-based labor and parts. On invoice/bill/portal, jobs render inside the existing **Services** section — no visual distinction from cloning/programming/add-key/all-keys-lost/extra charge.

### Unified row format for the Services section

Every services row (existing charges AND jobs) uses the same dotted-leader format:

```
Cloning ................................................ $120.00
Programming ............................................ $200.00
Brakes — replaced rotor and pads ....................... $180.00
Extra charge ............................................ $50.00
```

- Fixed services (cloning, programming, add key, all keys lost, extra charge): `Label ...... $price`.
- Jobs: `Name — description ...... $price` (em-dash + description only when description is set; otherwise `Name ...... $price`).

### Data model

`src/types/index.ts`:

```ts
export interface SessionJob {
  name: string;
  price: number;
  description?: string;
  createdBy?: string;
}
```

Extend `WorkSession` with `jobs?: SessionJob[]`. Backward-compatible; no migration (sessions live in JSON in `app_sync.data`).

### Billing math

`src/lib/billing.ts` (single source of truth):

- Add `computeSessionJobs(session)` → sum of `job.price`.
- Fold jobs into the **services** bucket of `SessionLaborDetails`, `TaskTotal`, `TaskTotalAllocated`, `VehicleTotal`. Totals reconcile with existing services aggregations everywhere.
- Keep an internal `jobs` sub-field on `SessionLaborDetails` so the renderer can list each job as its own row; the aggregate services number already includes them.
- Imported (XLS) tasks still lock to `importedSalary` (jobs ignored, matching current parts/services behavior).
- Vehicle discount continues to apply to labor + services — jobs, as part of services, are discountable (consistent with cloning/programming today).
- Update `src/lib/__tests__/billing.test.ts` with cases for: jobs added to services, jobs discounted with labor pool, jobs ignored when `importedSalary` set.

### Desktop editors (UI)

Add a **Jobs** section directly under the Parts section (same visual pattern as Parts):

- Row fields: **Name**, **Price**, **Description** (optional).
- "Add job" button; per-row delete.
- Persistence follows the existing parts onBlur pattern into the draft session; save propagates to `task.sessions`.

Files:
- `src/components/TaskInlineEditor.tsx`
- `src/components/EditTaskDialog.tsx`

**Mobile untouched** per your scope (`CompleteWorkDialog.tsx`, `TaskCard.tsx` unchanged).

### Invoice / bill rendering (dotted leaders everywhere in Services)

- `src/lib/billPdfLayout.ts` — introduce a shared services-row layout that renders `label` (or `name — description`) on the left, dotted leader filling the middle, price right-aligned. Apply to all services rows including jobs. Dot leader is drawn to align consistently regardless of label length.
- `src/lib/billPdfRenderer.ts` — refactor the services block to iterate a unified list `[fixedServices..., ...jobs]` and render each via the shared row helper; include in services subtotal.
- `src/components/DesktopInvoiceView.tsx` — mirror the dotted-leader format on-screen for both fixed services and jobs; update the manual-entry flow to accept jobs.
- `src/components/ShareBillDialog.tsx` — no structural change; totals already reflect services.

### Client portal

- `src/lib/clientPortalUtils.ts` — extend `SessionCostDetail` with `jobs: SessionJob[]`; each job's price contributes to `servicesCost`.
- `src/lib/portalToTask.ts` — round-trip jobs back into synthesized task.
- `supabase/functions/sync-portal/index.ts` — pass jobs through the payload (JSON only, no schema change).
- `src/pages/ClientPortal.tsx` — render the Services list using the shared dotted-leader row for both fixed services and jobs.

### Reports

- `src/components/DesktopReportsView.tsx`, `src/components/ClientCostBreakdown.tsx` — no new columns; jobs fold into existing services totals automatically.

### Out of scope

- No mobile edit UI for jobs.
- No changes to time-based labor, min-hour rule, or Extra Charge field.
- No new invoice section — jobs share the Services block.
- No backfill; sessions with no jobs behave as today.

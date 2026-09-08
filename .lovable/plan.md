# Bring back "Add Job" (fixed-price work) on the phone

## What I found

Nothing was deleted. The fixed-price **Jobs** feature (name + price + description, added to the bill as a service) only ever got built into the **desktop** editing screens:

- Desktop task editor: has "Add Job".
- Desktop full edit dialog: has "Add Job".
- **Phone edit screen: does not have it** — the phone uses a separate compact layout that was never given the Jobs block. It only has "Extra Charge" (a plain amount, no name/description).
- **The "work complete" screen (phone): does not have it** either — again only "Extra Charge".

You are on the phone view right now, which is why it looks gone. Any jobs you already added on desktop are still saved and still counted on bills and in the portal.

## What I will do

1. Add the same **Jobs** block (Name, Price, Description, delete, "Add Job" button) to the phone edit screen, sized for a small screen — one line per job stacked, not a wide table.
2. Add a **Jobs** block to the "work complete" screen, right under Billing Options, so a fixed-price job can be entered at the moment work is finished instead of afterwards.
3. Make sure jobs entered on the phone are saved with the session and flow into the bill, the PDF, and the client portal exactly as the desktop ones do (that math already exists — no change to how money is calculated).
4. Include jobs in the backup file export/import so they survive a backup restore (currently the backup file drops jobs and extra charge).

Nothing about existing totals, rates, or discounts changes.

## Technical notes

- `src/components/EditTaskDialog.tsx`: the mobile branch begins at the `if (isMobile)` return; the Jobs section currently lives only in the desktop branch. Reuse the existing `handleAddJob` / `handleUpdateJob` / `handleDeleteJob` handlers (already defined above the branch) with a compact stacked layout.
- `src/components/CompleteWorkDialog.tsx`: add local `jobs: SessionJob[]` state and extend the `onComplete` signature with `jobs`; update the caller `handleCompleteWork` in `src/pages/Index.tsx` to store `jobs` on the new session.
- Billing already folds `session.jobs` into services via `computeSessionLaborDetails` in `src/lib/billing.ts`; PDF (`billPdfRenderer.ts`) and portal (`clientPortalUtils.ts`) already render them — no changes needed there.
- `src/lib/xmlConverter.ts`: add `jobs` and `extraCharge` to session export/import.

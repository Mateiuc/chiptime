# Deposit history — track every payment, not just one total

Today a client (and a vehicle) has one single deposit number. You can only overwrite it, so you lose the history of when money came in and how much. This adds a proper deposit ledger.

## What you get

A **Deposits** panel on the client (and vehicle) with:

- A list of every deposit received: date, amount, method (cash / card / zelle / transfer / other), and an optional note.
- An **+ Add Deposit** row to record a new payment any time — it adds to the total instead of replacing it.
- Edit / delete on each entry (for typos), with the running total recalculated instantly.
- A total line: `Full Deposit: $4,700 (3 payments)`, clicking it opens the list.

Example:

```text
Deposits — Cornel Ungureanu                     Total $2,000
  Aug 02, 2026   $1,000   Zelle    "first half"
  Aug 14, 2026     $500   Cash
  Aug 22, 2026     $500   Card     "balance top-up"
  + Add Deposit
```

The existing math does not change: **After Billed** and **Still to Pay** keep working exactly as now — they just read the new total, which is the sum of the list.

## Where it appears

- Desktop dashboard client header — "Full Deposit: $X" becomes clickable and opens the deposits dialog.
- Desktop Clients view and the Add/Edit Client forms — same list component.
- Edit Vehicle dialog — same list for vehicle-level deposits.
- Client Portal — read-only list of deposits received, so the client can see their own payment history.
- Invoice / bill PDF — deposit block shows the total (unchanged) with an optional itemized list of payments.

## Migration of existing data

Any client or vehicle that currently has a deposit amount but no list gets one entry created automatically ("Initial deposit", dated from the record's creation date) the first time it is read. Nothing is lost and no numbers move.

## Technical notes

- New type `DepositEntry { id, amount, date, method?, note?, createdBy? }` in `src/types/index.ts`; add `deposits?: DepositEntry[]` to `Client` and `Vehicle`.
- `prepaidAmount` stays as the stored total and remains the field every calculation reads (`src/lib/deposit.ts`, `billing.ts`, `billPdfRenderer.ts`, `clientPortalUtils.ts`, `portalToTask.ts`, MCP tools). Whenever the list changes, `prepaidAmount` is rewritten to `sum(deposits)`, so no consumer logic changes and older/offline clients still work.
- Helper `src/lib/depositLedger.ts`: `normalizeDeposits(entity)` (back-fills a single entry from a legacy `prepaidAmount`), `addDeposit`, `updateDeposit`, `removeDeposit`, `depositTotal`.
- New shared component `src/components/DepositLedger.tsx` used by `AddClientDialog`, `AddClientPage`, `ManageClientsDialog`, `DesktopClientsView`, `EditVehicleDialog`, plus a small read-only variant for the portal.
- `src/lib/xmlConverter.ts` gains export/import of the deposit list so backups keep full fidelity.
- Consumed-deposit tracking (`task.depositApplied`) is untouched — it still drains against the total.

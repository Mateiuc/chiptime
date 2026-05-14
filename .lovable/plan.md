# P1 Hygiene Batch

Knock out 10 P1 audit items in one focused pass. No behavior changes; readability, safety, and quieter prod logs.

## Items & Approach

### #9 — Stale @deprecated comment (`src/types/index.ts:102`)
Rewrite `WorkSession.chargeMinimumHour` JSDoc to: "Legacy: superseded by `Period.chargeMinimumHour`. Keep for XML import compatibility; new code should use the per-period flag."

### #10 — Lying comment (`src/components/TaskCard.tsx:735`)
Replace with: "Phase 2: importedSalary short-circuits computeTaskTotal; render via amber Imported badge when present."

### #11 — Null-guard strict-mode TS errors
- `DesktopClientsView.tsx:187` — guard `selectedClient` (3 sites) with early returns or optional chaining as appropriate.
- `VinScanner.tsx` — guard `canvas`, `video`, `context` refs (13 sites). Add `if (!canvas || !video) return;` and `if (!ctx) return;` at the top of each handler.
- Do NOT touch global `tsconfig.strict`.

### #13 — `pluralize()` helper
New file: `src/lib/pluralize.ts`
```ts
export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural || singular + 's'}`;
}
```
Apply at: `DesktopReportsView.tsx:265`, `DesktopDashboard.tsx:964/1344`, `photoMigration.ts:102/162`, plus a `rg` sweep for any other "${n} vehicles/photos/clients/tasks/items" patterns.

### #14 — Customer → Client
Replace 'Customer' fallback strings in `TaskCard.tsx:355, :369` and any other UI string occurrences. Keep XML field names (wire format) untouched. `rg -n "Customer" src/` to enumerate; classify each before edit.

### #15 — Bill vs Invoice
Add header doc-comment block to both:
- `src/lib/billPdfRenderer.ts` — "Bill: customer-facing receipt with company decoration."
- `src/components/DesktopInvoiceView.tsx` — "Invoice: formal accounting document for records."
Audit `rg -n "Invoice|Bill" src/` for UI strings; fix any toast/button mismatches (e.g. `TaskCard.tsx:485` "Invoice saved as..." → "Bill saved as...").

### #16 — Env-ize hardcoded URLs (`src/lib/clientPortalUtils.ts`)
- L5: `https://chiptime.chipplc.one` → `import.meta.env.VITE_PORTAL_BASE_URL ?? 'https://chiptime.chipplc.one'`.
- L819, L860: replace `https://${projectId}.supabase.co/functions/v1/get-portal` with `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-portal`.
- Document `VITE_PORTAL_BASE_URL` in README (and `.env.example` if present).

### #17 — localStorage try/catch (`src/services/appSyncService.ts:29`)
Wrap synchronous localStorage write in try/catch; `console.warn` on failure, do not throw.

### #19 — DEV-only logger (Option A)
New file: `src/lib/devLog.ts`
```ts
export const dlog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
```
Replace `console.log` (NOT `.error`/`.warn`) at the listed call sites in:
`appSyncService.ts`, `useStorage.ts`, `Index.tsx`, `photoMigration.ts`, `cloudSyncService.ts`, `contactsService.ts`. Sweep each file with `rg -n "console.log"` to catch all sites.

### #22 — AlertDialog for EditTaskDialog delete (`EditTaskDialog.tsx:538–555`)
Replace inline Yes/No toggle with `<AlertDialog>` matching the pattern in `ManageClientsDialog.tsx:888, 925`.

### #23 — aria-labels on icon buttons
Sweep `rg -n 'size="icon"' src/` for every `<Button size="icon">` instance. Add `aria-label` describing the action. Confirmed sites include `Index.tsx:715, :718`; expect 30–60 total.

## Out of Scope
#12 dead code, #18 pushTimer singleton, #20 PDF magic numbers, #21 (already done), #24 (already done).

## Verification
- `bunx tsc --noEmit` clean
- `bunx tsc --strict --noEmit` confirms #11 sites fixed (informational only)
- `bunx vitest run` — 38/38 pass
- `rg -n "\\b1 (vehicles|photos|clients|tasks)\\b"` returns nothing
- `rg -nw "Customer" src/` returns only XML field names
- `bun run build` succeeds; spot-check bundle for `console.log` from gated sites

## Deliverable
Files modified count per item, new helper file locations (`src/lib/pluralize.ts`, `src/lib/devLog.ts`), env var deploy notes (`VITE_PORTAL_BASE_URL`), test output.

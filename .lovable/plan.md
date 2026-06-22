# Phase 3 — Clean up remaining billing duplicates and bugs

A read-only audit found **10 issues** where surface code still bypasses `src/lib/billing.ts` or uses stale fields. Some are display-only, but four cause real number mismatches between the PDF, portal, and dashboard.

## Issues grouped by severity

### A. Real money bugs (numbers disagree across surfaces)

1. **`billPdfRenderer.ts:195–201`** — per-session row amount computed as `(seconds/3600) * hourlyRate`. Skips minute-rounding and `chargeMinimumHour`, so itemised rows don't add up to the subtotal.
   → Use `computeSessionLaborDetails(session, client, settings).total` per row.

2. **`billPdfRenderer.ts:210–222`** — itemised parts list shows `price * quantity` for **all** parts, ignoring `providedByClient`. Totals block (which uses `computeSessionParts`) excludes them → rows disagree with TOTAL.
   → Skip or annotate `providedByClient` parts as `$0 (client supplied)`.

3. **`clientPortalUtils.ts:233–237`** — `ceilDollars` applied **per session** before summing into the discount base, inflating the discount base by up to `(sessions − 1)` dollars vs `computeVehicleTotal`.
   → Remove the per-session ceiling; ceil only the final display value.

4. **`DesktopClientsView.tsx:123`, `ManageClientsDialog.tsx:183 & 251`, `DesktopDashboard.tsx:750 & 785`** — copy-pasted `baseLab` formula subtracts only `cloning + programming`, silently merging `addKey + allKeysLost` into the "Labor Cost" PDF line.
   → Subtract all four service buckets; add matching `if (totalAddKey > 0)` / `if (totalAllKeysLost > 0)` PDF rows so the breakdown stays itemised.

### B. Stale-cache reads (display drift)

5. **`TaskCard.tsx:301`** and **`DesktopDashboard.tsx:695`** — `task.totalTime` used as authoritative duration. It's a cached integer that drifts when sessions are edited.
   → Sum `period.duration` directly (same pattern as `getTaskSeconds` in `DesktopReportsView.tsx:180`).

6. **`TaskCard.tsx:266–268`** — mini-PDF renders `providedByClient` parts at full price (same as issue 2, different file).
   → Same fix.

### C. Unsafe rate fallback

7. **`billPdfRenderer.ts:70`** — `client?.hourlyRate || settings.defaultHourlyRate` inline.
   → Use `resolveRates(client, settings).hourly`.

### D. Dead code

8. **`clientFinancials.ts:117–124`** — `getVehicleTotalWithDiscount` is a one-line wrapper around `computeVehicleTotal` with **zero callers** outside its own test.
   → Delete the export; update the test to import `computeVehicleTotal` directly.

### E. Type hygiene (optional, low risk)

9. **`types/index.ts` + `billing.ts:75–78`** — `Settings` declares `defaultCloningRate?`/`defaultProgrammingRate?`/`defaultAddKeyRate?`/`defaultAllKeysLostRate?` as `number?` already, so the `(settings as any)` casts in `resolveRates` are unnecessary.
   → Remove the `as any` casts.

## Items confirmed clean (no action)

- `task.billedAmount` — already gone everywhere.
- `status === 'billed'/'paid'` branching dollar math — none found.
- Local `formatCurrency`/`formatDuration` redefinitions — none.
- `importedSalary` lock — respected in billing, portal, and financials.
- `computeTaskCost` wiring in `DesktopReportsView` and `TaskCard` chip — correct.
- Supabase edge functions — no billing math.

## Files to edit

| File | Changes |
|---|---|
| `src/lib/billPdfRenderer.ts` | Fixes 1, 2, 7 |
| `src/lib/clientPortalUtils.ts` | Fix 3 |
| `src/components/DesktopClientsView.tsx` | Fix 4 (one site) |
| `src/components/ManageClientsDialog.tsx` | Fix 4 (two sites) |
| `src/pages/DesktopDashboard.tsx` | Fix 4 (two sites) + Fix 5 (drill-down row) |
| `src/components/TaskCard.tsx` | Fixes 5, 6 |
| `src/lib/clientFinancials.ts` | Fix 8 (delete dead export) |
| `src/lib/billing.ts` + `src/types/index.ts` | Fix 9 (remove `as any` casts) |
| `src/lib/__tests__/billing.test.ts` | Update import if the test referenced the removed wrapper; extend invariant test to cover `providedByClient` rows in the PDF renderer path |

## Out of scope

- No discount model change.
- No new helpers in `billing.ts` — all fixes route to existing functions.
- `calculateClientCosts` full replacement by `computeVehicleTotal` (would require a mapping layer for the `SessionCostDetail[]` shape consumed by `ClientCostBreakdown`); minimum fix is just removing the over-ceiling (issue 3). I will not refactor that shape in this pass.
- No UI / layout changes.

## Verification

- Existing cross-surface invariant test in `billing.test.ts` already asserts chip-sum ≈ vehicle total; will extend it with a `providedByClient: true` part and an Add Key + All Keys Lost session to lock in fixes 2/4/6.
- Manual: open a client with (a) a session under 1h with `chargeMinimumHour`, (b) one `providedByClient` part, (c) an Add Key job. Generate the bill PDF and the client report PDF; confirm itemised rows sum to the displayed TOTAL on both.

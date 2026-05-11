## Phase 2 — Delete `billedAmount` and surface `importedSalary`

### Part A — Remove `billedAmount` everywhere

1. **`src/types/index.ts`** — remove `billedAmount?: number` from `Task`. Keep `importedSalary`.

2. **`src/pages/Index.tsx` `handleMarkBilled` (~L469–L500)** — collapse to a pure status flip:
   ```ts
   updateTask(taskId, { status: 'billed' });
   setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'billed' as const } : t));
   ```
   Drop the `labor`/`billedAmount` computation block entirely.

3. **`src/pages/DesktopDashboard.tsx` `handleMarkBilled` (~L700–L730)** — same simplification.

4. **`src/lib/xmlConverter.ts`**
   - Export (~L82): remove the `billedAmount=...` attribute write.
   - Import (~L286–L288): drop the field silently — do not parse, do not assign. Leave `importedSalary` parsing intact.

5. **`src/lib/xlsImporter.ts`** — verify no `billedAmount` reference (rg shows none); no change expected.

6. **`src/lib/clientPortalUtils.ts`**
   - Remove `legacyLockedTotal` from `VehicleSummary` (~L41–L45) and the `llt` field on the slim portal payload (~L106).
   - Remove the accumulator block (~L182–L192) reading `task.billedAmount`/`task.importedSalary` for `legacyLockedTotal`.
   - Remove the encode (~L335) and decode (~L412) sites.

7. **`src/components/ClientCostBreakdown.tsx`** — delete the warning block at L393–L396 and any now-unused `legacyLockedTotal` references.

8. **`src/lib/billing.ts`** — update file-level doc comment: drop the "still written by `handleMarkBilled`" line; new behavior is "ignored on read, never written".

After Part A, `rg "billedAmount" src` returns **zero matches**.

**Legacy-data safety**: pre-Phase-1 records in IndexedDB may still carry a `billedAmount` field. Removing it from the `Task` type means TypeScript will not reference it; at runtime the extra property is harmless (JS objects accept unknown keys). On next save, the field is stripped because no code path writes it back. No migration script needed.

### Part B — Make `importedSalary` explicit

1. **`src/lib/billing.ts` `computeTaskTotal`** — short-circuit at the top:
   ```ts
   if (task.importedSalary != null && task.importedSalary > 0) {
     const v = task.importedSalary;
     return { labor: v, services: 0, parts: 0, total: v };
   }
   ```
   No other call site reads `importedSalary`. **Imported tasks contribute their `importedSalary` to the vehicle's labor pool and ARE subject to vehicle-level discount like any other task. The short-circuit only skips the per-session computation and parts roll-up — it does not exempt the task from downstream vehicle math.**

2. **New component `src/components/ImportedBadge.tsx`** — reusable amber chip:
   ```tsx
   <span className="inline-flex items-center gap-1 rounded-md border-2 border-amber-600 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
     Imported · parts not billed
   </span>
   ```

3. **Render the badge** wherever a task is shown, gated by `task.importedSalary != null && task.importedSalary > 0`, regardless of status:
   - **`src/components/TaskCard.tsx`** — header, adjacent to the status chip.
   - **`src/pages/DesktopDashboard.tsx`** — desktop task row (next to status).
   - **`src/components/ClientCostBreakdown.tsx`** — each portal task row (used by `/desk` and `/client-view`).

4. **No behavior changes** to parts-list visibility rules or the XLS importer. `importedSalary` remains writable only by the importer.

### Verification

- `rg "billedAmount" src` → zero matches.
- `rg "importedSalary" src` → reads only in `billing.ts` (calc) + `xmlConverter.ts` (load/save) + write sites (`xlsImporter.ts`, `DesktopDashboard.tsx` L252) + the three badge gates + the type def.
- Lamborghini task (no `importedSalary`) still shows **$350** on all six surfaces.
- Mercedes GLS: live computation unchanged.
- Any imported task: total equals `importedSalary` everywhere; adding parts does not change the total; amber badge visible in `/desk` and `/client-view` across all status tabs.
- Legacy "Total mismatch" warning no longer renders.
- **Legacy record check**: open a task created and billed before Phase 1 (any pre-existing Mercedes GLS or earlier paid task) and confirm:
  - Task loads without TypeScript or runtime errors despite IndexedDB possibly still containing a `billedAmount` value.
  - Displayed total matches what `computeTaskTotal` returns from live session/part data.
  - Saving the task back to IndexedDB strips the legacy `billedAmount` field from the stored record.

### Out of scope

Cost/Due label fix, min-hour flag reconciliation, paid-status validation.

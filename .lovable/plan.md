## Goal
Add a manual dollar-amount field inside the **Billing Options** block of the Complete Work dialog (mobile) and the equivalent inline editor (desktop). The amount is added to the task/vehicle total, but does **not** affect working hours, minute rounding, or the hourly rate.

It behaves like the existing service toggles (Cloning, Programming, Add Key, All Keys Lost): stored on the `WorkSession`, flows through the "services" bucket in billing math, and shows up on chips, reports, portal, and PDF.

## UX

In `CompleteWorkDialog.tsx`, under Billing Options, after "All Keys Lost", add a row:

```
[💵]  Extra Charge         [ $ 0.00 ]
      Manual amount, not tied to time
```

- Number input (string state, like parts prices — per Core memory rule).
- Empty / 0 = no extra charge (no row rendered on bill).
- Same treatment in `TaskInlineEditor.tsx` (desktop inline editor for a session), if it exposes the other service toggles — otherwise leave desktop dialog unchanged.

Proposed label: **"Extra Charge"** with helper text *"Manual amount, not tied to time"*. Open to renaming (Adjustment / Extra / Custom Fee) — say the word.

## Technical

### 1. Type
`src/types/index.ts` — extend `WorkSession`:
```ts
extraCharge?: number; // Manual $ amount, added to services bucket, not time-based
extraChargeLabel?: string; // Optional label shown on bill (defaults to "Extra")
```
(Label can be phase-2 if we want to keep this small — say the word.)

### 2. Billing math — `src/lib/billing.ts`
In `computeSessionLaborDetails`:
- Add `extra` computed field: `const extra = num(session.extraCharge);`
- Include in `services` bucket: `services = cloning + programming + addKey + allKeysLost + extra`
- Expose `extra` on `SessionLaborDetails` for renderers that want to itemize.

Because it goes through `services`, it automatically:
- Adds to `computeTaskTotal.services` and `.total`
- Participates in the vehicle-level discount pool (labor + services get discounted; parts don't). If we want extra charges to be **non-discountable**, we route them through parts instead — flag this preference.

### 3. Dialog wiring — `CompleteWorkDialog.tsx`
- New `extraCharge` string state, parsed on submit.
- Extend `onComplete` signature to pass `extraCharge: number`.
- Reset on close.

### 4. Callers of `onComplete`
Update the parent(s) that call `CompleteWorkDialog` — `TaskCard.tsx` / mobile flow — to persist `extraCharge` on the session being completed.

### 5. Bill PDF — `src/lib/billPdfRenderer.ts` / `billPdfLayout.ts`
If session's `extraCharge > 0`, render an itemized row `Extra — $X` (or the custom label) in the services block. Uses existing `stripDiacritics` per Core rule.

### 6. Client portal — `src/pages/ClientPortal.tsx` / cost calc
Portal already reads the shared billing helpers, so the amount flows through automatically once `computeSessionLaborDetails` includes it. Sanity check portal sync includes the new fields (they're inside `WorkSession`, which syncs whole — no schema change needed).

### 7. Tests — `src/lib/__tests__/billing.test.ts`
Add cases:
- `extraCharge` alone → `services === extra`, `labor === 0`
- `extraCharge` + hourly session → labor unchanged, services includes extra
- Imported task ignores `extraCharge` (importedSalary short-circuit still wins — matches parts behavior)
- Extra participates in vehicle discount pool (or does not, depending on the flag choice above)

## Not changing
- Timer logic, session periods, min-hour rules.
- Parts flow (still separate, non-discountable).
- `importedSalary` short-circuit (imported tasks continue to lock to the imported dollar amount).

## Open questions (fast to answer)
1. Label: **"Extra Charge"** OK, or prefer *Adjustment / Custom Fee / Extra*?
2. Should the extra amount be **discountable** (goes through services pool — default plan) or **non-discountable** (routed like parts, pass-through)?
3. Add the optional per-session label field now, or keep it fixed as "Extra" for v1?

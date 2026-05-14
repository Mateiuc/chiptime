# P0 #7 — Fire-and-forget `.catch` Sweep

## Audit findings

Searching `src/` for `.then(` without `.catch` and reviewing the 7 known sites turned up the following landscape. Most "known" sites already have a `.catch`, but they only call `console.warn` with no user-visible toast — which is the actual bug the audit is targeting. A few new sites surfaced too.

| # | File | Line | Current state | Action |
|---|------|------|---------------|--------|
| 1 | `src/components/TaskCard.tsx` | 619 | `.catch(console.warn)` only | Upgrade to `console.error` + destructive toast |
| 2 | `src/pages/Index.tsx` | 65 | **No `.catch` at all** (`reconcileCloudPhotos`) | Add `.catch` with `console.error` (silent — background reconcile, toast would be noisy on every cold start with a flaky network) |
| 3 | `src/pages/Index.tsx` | 377 | `.catch(console.warn)` portal sync | Upgrade to `console.error` + toast |
| 4 | `src/pages/Index.tsx` | 486 | same | same |
| 5 | `src/pages/Index.tsx` | 505 | same | same |
| 6 | `src/pages/DesktopDashboard.tsx` | 426 | same | same |
| 7 | `src/pages/DesktopDashboard.tsx` | 439 | same | same |
| 8 | `src/contexts/AuthContext.tsx` | 91 | **No `.catch`** on `supabase.auth.getSession()` — failure leaves `loading=true` forever | Add `.catch` that logs + calls `setLoading(false)` so UI unblocks; no toast (auth surfaces its own errors) |

Other `.then` matches found by ripgrep are not bugs:
- `src/test/mockSupabase.ts:77,79` — test scaffolding
- `src/lib/clientPortalUtils.ts:680` — runs inside the injected portal HTML; already has its own `.catch(pinFail)`

No bare promise-returning calls used as statements were found beyond these. No async functions called without `await` in sync handlers were found beyond these.

## Pattern

```ts
somethingAsync()
  .then(result => { /* existing */ })
  .catch(err => {
    console.error('[Component] Failed to <op>:', err);
    toast({
      variant: 'destructive',
      title: '<title>',
      description: '<actionable message>',
    });
  });
```

## Per-site messages

- **TaskCard.tsx:619** — title `Photo upload failed`, desc `The photo was saved locally but couldn't reach the cloud. It will retry on next sync.`
- **Index.tsx:65** — log only, no toast. Reason: this runs once on mount inside `performMigration`; failure is benign (next sync will retry) and a toast on every cold-start network blip would train users to ignore them. Flagged per the prompt's "rare, benign" guidance.
- **Index.tsx:377 / 486 / 505** and **DesktopDashboard.tsx:426 / 439** — all five are `syncPortalToCloud` calls. Title `Portal sync failed`, desc `Couldn't update the client portal. Your local changes are safe and will retry on next sync.` Tailor the verb (status change vs. complete-work) only if the existing wording differs meaningfully — they are all status-flip syncs, so one message fits.
- **AuthContext.tsx:91** — `console.error('[Auth] Failed to fetch existing session:', err)` and call `setLoading(false)` in the catch so the app doesn't hang. No toast; auth UI handles user-facing messaging.

## Imports

- `Index.tsx`, `DesktopDashboard.tsx` — `toast` already imported (used elsewhere). Verify and reuse.
- `TaskCard.tsx` — already imports `toast`.
- `AuthContext.tsx` — no toast needed.

## Out of scope

- No conversion of fire-and-forget to `await` — the portal-sync chains are intentionally non-blocking so the UI status flip stays instant. Keeping them async is correct.
- No changes to `clientPortalUtils.ts` injected-script `.then` (different runtime, already handled).

## Verification

1. `bunx tsc --noEmit` — expect no new errors.
2. `bunx vitest run` — 38 tests still pass (no logic changes, only error paths).
3. Smoke test: stub `photoStorageService.uploadPhotoToCloud` to reject in dev. Confirm console shows `[TaskCard] Failed to upload photo to cloud:` and the destructive toast appears with the photo-upload message; rest of the UI continues working.

## Deliverable summary

- Files modified: `src/components/TaskCard.tsx`, `src/pages/Index.tsx`, `src/pages/DesktopDashboard.tsx`, `src/contexts/AuthContext.tsx` (4 files).
- Catches added/upgraded: 8 total — 6 toast upgrades (1 TaskCard + 3 Index + 2 DesktopDashboard), 2 new catches (Index reconcileCloudPhotos log-only, AuthContext getSession log + unblock loading).
- Conversions to `await`: none (portal syncs intentionally non-blocking; documented above).
- Smoke-test result reported after implementation.

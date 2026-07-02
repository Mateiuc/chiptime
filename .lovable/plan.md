## Two fixes

### 1. Paid date editor doesn't show

Today the field only renders when `task.status === 'paid'`. If you open a **Billed** (or any non-paid) task the row isn't there — that's why you saw "no button". Fix:

- In `src/components/EditTaskDialog.tsx`, show the Paid date row for both **paid** and **billed** tasks (desktop only). Empty value allowed; typing a date + Save will persist `paidAt`, marking-as-paid still auto-fills it if left empty.
- No layout change beyond the extra visibility rule.

### 2. Photos not available on Desktop

Console shows `sign-photo-urls failed: Failed to send a request to the Edge Function` on load, followed later by `could not sign URLs`. Root cause: the shared CORS allowlist in `supabase/functions/_shared/cors.ts` doesn't cover the **preview iframe origin** `*.lovableproject.com` (only `chiptime.chipplc.one` and whatever `LOVABLE_PREVIEW_ORIGIN` resolves to). Preflight returns a mismatched `Access-Control-Allow-Origin`, so the browser blocks the request — every photo stays unsigned.

Fix:

- In `supabase/functions/_shared/cors.ts`, add built-in wildcard entries for `.lovableproject.com`, `.lovable.app`, and `.lovable.dev` (https only, leading-dot suffix, same safe check already used for env-driven wildcards). Keeps the env-based allowlist as an override.
- No changes to individual functions; all of them pick this up automatically on next deploy.
- After deploy, the initial `signPhotoUrls` call succeeds and the existing UI (thumbnails + "retry" chip) will render the photos with no further changes.

### Files touched

- `src/components/EditTaskDialog.tsx` — broaden the `!isMobile && status === 'paid'` guard to include `'billed'`.
- `supabase/functions/_shared/cors.ts` — add built-in wildcard preview origins.

### Not touched

- Reports, deposit math, mobile UI, storage/RLS, edge function logic (`sign-photo-urls/index.ts` stays as-is).

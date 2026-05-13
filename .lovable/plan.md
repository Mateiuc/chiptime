# Photos visibility fix — revised plan (v2)

## 1. `supabase/functions/sign-photo-urls/index.ts` — strict per-path ownership

Replace the current "starts with `${wsId}/`" filter with a per-path ownership check that handles both prefixed and legacy paths.

Resolve caller's workspace (already done): `wsId = user_primary_workspace(auth.uid())`.

For each requested path:

- **Prefixed** `wsId2/taskId/photoId.jpg` (3 segments, ends `.jpg`): reject unless `wsId2 === wsId`. Validate each segment with `/^[a-zA-Z0-9._-]+$/`, no `..`, no `//`.
- **Legacy** `taskId/photoId.jpg` (2 segments, ends `.jpg`): validate segments. Verify the caller's workspace owns the task by querying `app_sync` with the service-role client:
  ```sql
  select 1 from app_sync
   where workspace_id = $1
     and data @? format('$.tasks[*] ? (@.id == "%s")', $2)::jsonpath
   limit 1
  ```
  Cache `taskId → boolean` per request so a batch of N photos from one task does one lookup.
- **Anything else**: silently drop (no information leak).

Survivors go to `storage.createSignedUrls`.

## 2. `src/lib/clientPortalUtils.ts` — emit canonical paths, not URLs

In the photoUrls/`n` builder (~line 273), prefer `cloudPath`; if absent, derive a path from `cloudUrl` via the `/session-photos/(.+)$` regex (minus query). Emit `{ path?, url? }` objects so the portal can sign before rendering. Update the portal payload type.

## 3. Portal sign step (server-side, recommended)

Add signing to the existing `get-portal` edge function: it already validates the PIN and knows the portal's workspace, so after building the payload it can:

- Collect every photo `path` across all sessions.
- Apply the same per-path ownership rules as fix #1, scoped to the portal's workspace.
- Call `storage.createSignedUrls` once.
- Replace each photo's `url` with the signed URL; keep the original `cloudUrl` only as last-resort fallback.

This avoids exposing any new authenticated surface to anonymous portal viewers.

## 4. `src/components/ClientCostBreakdown.tsx` — visible failures

Add `onError` on each `<img>` to swap to a placeholder (image-broken icon + "Photo unavailable" caption). Apply to both the gallery thumbnails and the lightbox.

## 5. `src/components/TaskCard.tsx` capture flow — fix the race

In the fire-and-forget `.then()` at lines 618–629:
- Re-fetch tasks via `capacitorStorage.getTasks()` inside the handler.
- Find the photo by `photoId` in the fresh task and merge `cloudUrl` + `cloudPath` onto it.
- Persist via `onUpdateTask`.

Also add a one-shot startup reconciler (native only) in `App.tsx` or `photoMigration.ts`: scan tasks for photos with `filePath` but no `cloudPath`, load the local file via `photoStorageService.loadPhoto`, re-run `uploadPhotoToCloud` (idempotent — bucket upsert is on), and persist `cloudPath`. This rescues photos still trapped on the device.

## 6. Universal cloudPath backfill (all workspaces, all tasks)

One-time SQL migration that walks every `app_sync` row and writes `cloudPath = '<taskId>/<photoId>.jpg'` onto every photo that has `filePath` but no `cloudPath`. Unconditional — orphans are handled by fix #4's `onError` UI.

Sketch:

```sql
-- Update every app_sync row in place by remapping the photos arrays.
update public.app_sync as a
   set data = jsonb_set(a.data, '{tasks}',
     (select jsonb_agg(
        case when t ? 'sessions' then jsonb_set(t, '{sessions}',
          (select jsonb_agg(
             case when s ? 'photos' then jsonb_set(s, '{photos}',
               (select jsonb_agg(
                  case
                    when (p ? 'filePath') and not (p ? 'cloudPath')
                    then p || jsonb_build_object(
                      'cloudPath',
                      (t->>'id') || '/' || (p->>'id') || '.jpg')
                    else p
                  end)
                from jsonb_array_elements(s->'photos') p))
             else s end)
           from jsonb_array_elements(t->'sessions') s))
        else t end)
      from jsonb_array_elements(a.data->'tasks') t))
 where a.data ? 'tasks';
```

Run in a transaction. Report counts via a follow-up `SELECT` over the same shape (count of photos where `cloudPath` is set, count where `filePath` is set, count where `cloudPath` exists but `filePath` exists — proxy for newly-backfilled).

This must be a **`supabase--insert`** call (data update, not schema), per the data-vs-migration rule.

## Verification

- Deploy `sign-photo-urls`. Curl with: valid prefixed path, legacy path the caller owns, legacy path the caller does NOT own (drop), traversal attempt (drop).
- Run the backfill; report `before/after` photo counts where `cloudPath` is set.
- Open the Valy client portal — all 7 photos render. Open another client portal with photos — should also render.
- Regenerate the Mercedes bill PDF — all 7 photos appear.
- On a phone build, capture a new photo: confirm `cloudPath` lands on the photo without race-clobber.

## Out of scope

- Migrating bucket files to the prefixed `wsId/taskId/photoId.jpg` layout (ownership check covers it).
- Changing the bucket from private to public.
- Lightbox UX beyond the broken-image fallback.

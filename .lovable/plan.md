## What I found

Verified the file actually exists in storage:

- DB row (Ovidiu Hapca → 2014 GL-Class → Session 3):
  - `cloudPath = "bb72a59d-4ba0-46d8-af5d-3ed375a1ffb2/a3cfdd77-6bfc-4835-b480-bb2a3a6823b0.jpg"` (legacy 2-segment, no `wsId/` prefix)
  - `cloudUrl  = "https://…/storage/v1/object/public/session-photos/bb72a59d…/a3cfdd77…jpg"`
- Storage object exists at exactly that 2-segment path in bucket `session-photos`.
- Bucket `session-photos` is **private** (`public = false`).

So the file is fine. What's broken is the **URL** the UI tries to render:

1. The legacy `cloudUrl` points at `/object/public/…` but the bucket is private, so that URL is 400/dead. Desktop already excludes those (good), but `billPdfRenderer.ts:510-511` still tries to fetch it directly first.
2. The frontend depends on `sign-photo-urls` to mint a signed URL from `cloudPath`. When signing returns nothing (auth expired, legacy-path ownership check missing the row, or the chiptime-default sync row with `workspace_id IS NULL`), every surface silently falls back to "device only" / broken — with no visible hint why.
3. `sign-photo-urls`' legacy-path branch only matches `app_sync` rows where `workspace_id = wsId`. The shared `sync_id='chiptime-default'` row (`workspace_id IS NULL`) is invisible to that check, so any task that only exists in the shared row can't have its legacy photos signed.

## Fix

### 1. `supabase/functions/sign-photo-urls/index.ts`
Make ownership check tolerant of the legacy shared row:
- Change the `app_sync` filter from `.eq('workspace_id', wsId)` to `.or(\`workspace_id.eq.${wsId},sync_id.eq.chiptime-default\`)`.
- Log (warn) the dropped paths and reason so we can see future failures in edge logs instead of silently returning `{}`.

### 2. `supabase/functions/upload-photo/index.ts`
On every successful upload, return the new prefixed `wsId/taskId/photoId.jpg` path (already does). Nothing to change here, but document that the canonical reference going forward is `path` (3-segment), not `cloudUrl`.

### 3. `src/pages/DesktopDashboard.tsx` (~lines 1890-1913)
- When `viewable.length === 0` and at least one photo has a `cloudPath`/`cloudUrl`, render a "Photo couldn't load — retry" affordance instead of "device only". Clicking it re-invokes `signPhotoUrls` for that path and updates the map. This makes signing failures visible and recoverable instead of silent.
- Add a one-time `console.warn` listing paths that came back unsigned so users (and we) can see the cause in DevTools.

### 4. `src/lib/billPdfRenderer.ts` (lines 510-525)
- Stop trusting `/object/public/…` URLs first — for a private bucket they always 4xx. Reorder so signing is attempted before any direct `fetchUrlAsBase64(cloudUrl)`. Only fall back to `cloudUrl` if it's a non-public signed URL.
- Surface the per-photo failure reason in the existing `[bill] photos: X ok, Y failed` log line (path + reason), so PDF gaps become diagnosable.

### 5. `src/pages/ClientPortal.tsx` + `src/lib/clientPortalUtils.ts`
- Mirror the same "sign first, public URL last" ordering used by the desktop fix. No new endpoint needed — the portal already gets pre-signed URLs from `get-portal`/`sync-portal`; verify it isn't accidentally persisting `/object/public/` URLs from the source data into the portal payload. If it is, strip and re-sign on the server side before responding.

### 6. One-time data normalization (optional, no schema change)
- A short read-only script (no migration) to scan `app_sync.data->tasks[*].sessions[*].photos[*]` and report any photos whose `cloudPath` is missing while `cloudUrl` contains `/object/public/`. Output the count so we know how many legacy entries still rely on the public URL. We don't auto-migrate — once #1 is in, signing those works.

## Verification

1. Log in → open Ovidiu Hapca → 2014 GL-Class → expand Session 3 → photo thumbnail renders (no broken icon, no "device only").
2. Generate the bill PDF for that task → the photos page shows the image, not "(Image could not be loaded)".
3. Open the same client's portal → same photo visible.
4. In DevTools network tab, the photo `<img>` `src` is a `/storage/v1/object/sign/session-photos/…?token=…` URL (not `/object/public/…`).
5. `supabase/functions/sign-photo-urls` edge logs show no "dropped path" warnings for legitimate paths.

## Out of scope

- Changing the bucket back to public (security regression).
- Re-uploading old photos under the new `wsId/taskId/photoId.jpg` scheme.
- Any billing/math/UI redesign.

## Files

- `supabase/functions/sign-photo-urls/index.ts`
- `src/pages/DesktopDashboard.tsx`
- `src/lib/billPdfRenderer.ts`
- `src/pages/ClientPortal.tsx`
- `src/lib/clientPortalUtils.ts`

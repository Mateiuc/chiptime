## Problem

Photos in work sessions fail to load with "Bucket not found" / 404. The desktop dashboard renders `<img src={photo.cloudUrl}>` directly, but:

1. The `session-photos` bucket is **private** — the legacy `/object/public/...` URLs return 404.
2. Even valid signed URLs (`/object/sign/...`) expire after 24h, so saved `cloudUrl` values stop working.

The canonical reference is `photo.cloudPath`. The `sign-photo-urls` edge function already exists to mint fresh short-lived signed URLs for the caller's workspace.

## Fix

Refresh signed URLs at render time in the desktop dashboard photo strip (and any other view that renders cloud photos directly).

### Changes

1. **`src/pages/DesktopDashboard.tsx`** (around line 1808–1822):
   - Collect all `cloudPath` values for the currently-visible task's session photos.
   - Call `photoStorageService.signPhotoUrls(paths)` once when the task expands (or in a `useEffect` keyed on visible task IDs) and store the resulting `path → signedUrl` map in local state.
   - Render `<img src={signedUrlMap[photo.cloudPath] ?? photo.cloudUrl}>`. Filter the "device only" badge by `!photo.cloudPath && !photo.cloudUrl` instead of just `!cloudUrl`.
   - Show a small placeholder while signing is pending; show `ImageOff` if signing returned no URL for that path.

2. **`src/components/TaskCard.tsx`** (PDF generation paths around lines 587 and similar): when `fetch(item.photo.cloudUrl)` fails or `cloudUrl` is absent but `cloudPath` exists, mint a fresh signed URL via `signPhotoUrls([cloudPath])` and fetch that instead. This prevents PDFs from silently dropping cloud-only photos whose URLs have expired.

3. **Backfill missing `cloudPath`** (defensive): for legacy photos that only have a `cloudUrl` pointing at `/object/public/session-photos/<workspace>/<task>/<photo>.jpg`, derive the path by stripping the prefix so the same render path works. Add this small helper in `photoStorageService` and use it when collecting paths.

### Out of scope

- No schema or RLS changes. The bucket stays private and `sign-photo-urls` keeps enforcing workspace-scoped access.
- No change to upload flow — `upload-photo` already returns a 24h signed URL plus the canonical path.

## Technical notes

- `signPhotoUrls` accepts up to 200 paths per call and returns `{ [path]: signedUrl }`. Default TTL 1h is fine for a render session.
- Keep the signed-URL map in component state, not in persisted task data, so it's never stale on disk.

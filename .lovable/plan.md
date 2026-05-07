## Heads up before running this

According to the current Lovable Cloud configuration I can see, the `diagnostic-pdfs` bucket **already exists** (created as **private**, which matches the rest of the code):

```
Bucket Name: diagnostic-pdfs
Is Public: No
```

The whole diagnostic PDF flow is built around this bucket being **private**:
- `upload-diagnostic` edge function uploads to `diagnostic-pdfs` and returns a **signed URL**.
- `sign-diagnostic-url` edge function mints fresh signed URLs (auth-checked, workspace-scoped).
- `get-portal` calls `createSignedUrls('diagnostic-pdfs', ...)` to generate short-lived URLs for the public portal.

If we make the bucket **public** (as your SQL would), the bucket itself isn't the problem (your `INSERT … ON CONFLICT DO NOTHING` would no-op since it already exists), and we'd be loosening security with no benefit — the portal already works through signed URLs.

### What's likely actually causing the 404 on the portal

A 404 on diagnostic PDFs in the live portal is almost always one of:
1. **The stored `dpdf` value is a stale signed URL** (signed URLs from `upload-diagnostic` expire after 7 days). If only a URL is saved (no storage `path`), `get-portal`'s `signPortalDiagnosticPdfs` can't re-sign it, and once it expires → 404.
2. **The `dpdf` path doesn't exist** in the bucket (e.g., uploaded to a different workspace, or never uploaded successfully).
3. **The path stored in `dpdf` is wrong** (e.g., missing `wsId/` prefix).

### Proposed plan

1. **Do not run the public-bucket SQL** — bucket already exists and should stay private.
2. **Diagnose the 404**:
   - Ask which client portal / vehicle is showing the 404 so I can read `client_portals.data` and inspect the `dpdf` values.
   - Check edge function logs for `get-portal` and `sign-diagnostic-url` for the failing request.
   - List actual objects in the `diagnostic-pdfs` bucket to confirm whether the file is missing or just unsigned.
3. **Fix based on findings**, e.g.:
   - If stored value is a URL only → migrate to also store `path`, and update upload flow / portal payload to always include `path`.
   - If file is missing → re-upload from source.
   - If path is malformed → patch the stored portal payload.

### What I need from you to proceed

- The portal link (or client name) where you see the 404, **or** confirmation that I should just go check the logs and bucket contents to find the broken record.
- Confirmation that you do **not** want the bucket switched to public (recommended: keep it private).
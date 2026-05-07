## What I found

The 404 is real and reproducible:

- The stored `dpdf` value for portal `wyojkbhl` (Valy Ilasca) is a **public-bucket URL**:
  `https://.../storage/v1/object/public/diagnostic-pdfs/96577188-.../benz_valy.pdf`
- The bucket `diagnostic-pdfs` is **private**, so `/object/public/...` returns 404.
- The actual file **does exist** in storage at path `96577188-.../benz_valy.pdf` — confirmed.
- `get-portal`'s `signPortalDiagnosticPdfs` only signs entries that look like storage paths; it skips anything starting with `http(s)://`, so the legacy public URL is passed through unchanged → 404 in the browser.

This is a legacy-data problem: older sessions saved the public URL into `diagnosticPdfUrl` (now `dpdf`). The newer `upload-diagnostic` flow returns a `path` too, but the app side (`s.diagnosticPdfUrl`) only ever stored the URL, so we have no `path` field to fall back on.

## Recommendation

**Keep the bucket private.** Don't run the public-bucket SQL — it would loosen security and not even fix legacy URLs that point at `/object/public/...` (those would suddenly start working only because the bucket flipped public).

Instead, teach `get-portal` to recover the storage path from a legacy public URL and re-sign it. This fixes Valy's portal and any other portal that has the same legacy data, with no DB migration.

## Plan

1. **`supabase/functions/get-portal/index.ts` — `signPortalDiagnosticPdfs`**
   - For each `dpdf` entry, also detect legacy public URLs of the form
     `.../storage/v1/object/public/diagnostic-pdfs/<path>` **and**
     `.../storage/v1/object/sign/diagnostic-pdfs/<path>?token=...` (expired signed URLs).
   - Extract `<path>` (everything after `/diagnostic-pdfs/`, stripped of query string), add it to the set of paths to sign, and replace `session.dpdf` with the freshly-signed URL.
   - Leave non-matching `http(s)` entries untouched (defensive).

2. **No DB migration needed.** Optional follow-up (not in this change): a one-off script to rewrite legacy `dpdf` URLs in `client_portals.data` to bare paths, so future syncs are uniform. Skipping unless you ask for it.

3. **Verify**
   - Re-call `get-portal?id=wyojkbhl&...` and confirm `dpdf` comes back as a fresh signed URL that returns 200.
   - Open Valy's portal in the live app and confirm the "View Diagnostic Report" link opens the PDF.

## Technical notes

- Path-extraction regex: `/\/storage\/v1\/object\/(?:public|sign)\/diagnostic-pdfs\/([^?]+)/`.
- Signed URLs expire in 1h (existing TTL), same behavior as today's photo signing.
- `sync-portal` / upload flow are unchanged — fix is read-side only, so it covers all existing rows.

## What I need from you

Confirm: proceed with the read-side fix in `get-portal` (recommended) — or do you want me to also run a one-off cleanup that rewrites legacy `dpdf` URLs in the database to bare storage paths?

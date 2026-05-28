Root cause found: the photos exist in private storage, but `sign-photo-urls` is rejecting almost all of them before signing.

The current signer uses this ownership check:

```text
.filter('data', '@?', '$.tasks[*] ? (@.id == "...")')
```

Lovable Cloud’s data API rejects that JSON-path operator, producing `PGRST100 unexpected "@"`, so the function logs `no-task-ownership` and returns no signed URL. Your current workspace has 80 photos stored as legacy two-part paths like:

```text
taskId/photoId.jpg
```

Those are exactly the ones being dropped.

Plan:

1. Update `supabase/functions/sign-photo-urls/index.ts`
   - Remove the unsupported JSON-path `.filter('data', '@?', ...)` query.
   - Fetch the caller’s workspace sync row plus the legacy `chiptime-default` row.
   - Check task ownership in TypeScript by scanning `data.tasks[].id` safely.
   - Keep the existing workspace-prefixed path validation for newer three-part paths.
   - Keep warning logs, but they should now only show truly invalid/missing tasks.

2. Deploy and test the signer
   - Call `sign-photo-urls` for a known existing legacy path:
     `bb72a59d-4ba0-46d8-af5d-3ed375a1ffb2/a3cfdd77-6bfc-4835-b480-bb2a3a6823b0.jpg`
   - Confirm it returns a signed URL, not `{}`.
   - Check logs confirm no `PGRST100` errors.

3. Verify app behavior
   - Desktop dashboard photo thumbnails should render because `photoSignedUrls[path]` will now be populated.
   - Bill PDF photo loading should work because it uses the same signing service.
   - Client portal photos should already be handled separately by `get-portal`, so no extra portal change unless verification shows a separate failure.

No bucket will be made public and no photo files need re-uploading.
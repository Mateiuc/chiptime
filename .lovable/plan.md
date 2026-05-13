## Root cause

The Phase 13 universal `cloudPath` backfill wrote a literal `null` element into the `data.tasks` array on two `app_sync` rows (Mercedes workspace `92b1ba2d…` and one unscoped row). Cloud sync pulls these arrays into the desktop dashboard, which iterates `tasks.filter(t => t.status === ...)` — reading `.status` on `null` throws, the ErrorBoundary catches it, and the user sees "Cannot read properties of null (reading 'status')". The `/desk` route flashes for ~1s during initial render and then unmounts into the error UI.

Verified via `psql`:

```
workspace_id                          | task_count | null_status
92b1ba2d-7935-4959-8a30-c55375779c88  |    60      |     1
(unscoped)                            |    53      |     1
```

Both null entries are literal `null` JSONB values inside `data.tasks`.

## Fix

**1. Data cleanup — SQL migration**

For every `app_sync` row, rebuild `data.tasks` excluding `null` entries:

```sql
UPDATE public.app_sync
SET data = jsonb_set(
  data,
  '{tasks}',
  COALESCE(
    (SELECT jsonb_agg(t)
       FROM jsonb_array_elements(data->'tasks') t
      WHERE t IS NOT NULL AND t <> 'null'::jsonb),
    '[]'::jsonb
  )
)
WHERE data ? 'tasks'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'tasks') t
    WHERE t IS NULL OR t = 'null'::jsonb
  );
```

Apply the same cleanup to `data.clients` and `data.vehicles` defensively (same shape — same backfill could in principle have hit them too).

**2. Defensive filter — `src/services/cloudSyncService.ts` (and/or `appSyncService.ts`)**

When merging or applying remote `app_sync.data`, sanitize each top-level array:

```ts
data.tasks    = (data.tasks    ?? []).filter((t: any) => t && typeof t === 'object' && t.id);
data.clients  = (data.clients  ?? []).filter((c: any) => c && typeof c === 'object' && c.id);
data.vehicles = (data.vehicles ?? []).filter((v: any) => v && typeof v === 'object' && v.id);
```

Mirror in `capacitorStorage.setTasks` (already strips `billedAmount`) so a bad payload from any source can't corrupt local storage.

**3. Verify**

- After the migration, `SELECT … WHERE t IS NULL` returns 0 rows.
- Reload `/desk` while signed in as the Mercedes workspace user — page renders without ErrorBoundary.
- No regression: client list + dashboard counts unchanged.

## Out of scope

- Diagnosing exactly which line in the original backfill created the `null` (the data is already in place; cleanup + defense is sufficient).
- Any UI changes to `/desk`.

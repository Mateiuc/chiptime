

# Copy Data to chiptime-default Row

## Problem
The app queries `sync_id = 'chiptime-default'` but that row doesn't exist. The real data lives under `sync_id = 'c2c4cedb36129ec1a2541c195c3d1875'`.

## Fix
Use the database insert tool to copy the data from the existing row into a new `chiptime-default` row.

```sql
INSERT INTO public.app_sync (sync_id, data, updated_at)
SELECT 'chiptime-default', data, now()
FROM public.app_sync
WHERE sync_id = 'c2c4cedb36129ec1a2541c195c3d1875'
ON CONFLICT (sync_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
```

No code changes needed — `appSyncService.ts` already reads from `chiptime-default`.


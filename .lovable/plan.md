

## Rename to "Auto-Tracker" + Database-Backed Client Portal

This plan covers renaming the app and building the full cloud portal with photo storage.

---

### Step 1: Rename App to "Auto-Tracker"

Update branding in 3 files:
- **index.html** -- title, meta description, og:title, author, apple-mobile-web-app-title
- **vite.config.ts** -- PWA manifest `name` to "Auto-Tracker", `short_name` to "AutoTracker"
- **src/pages/Index.tsx** (line 564) -- header text

---

### Step 2: Database Migration

Create `client_portals` table and `session-photos` storage bucket in a single migration:

```sql
CREATE TABLE public.client_portals (
  id text PRIMARY KEY,
  client_local_id text UNIQUE NOT NULL,
  client_name text NOT NULL,
  access_code text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read portals"
  ON public.client_portals FOR SELECT USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('session-photos', 'session-photos', true, 5242880);

CREATE POLICY "Anyone can read photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'session-photos');

CREATE POLICY "Service role can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'session-photos');
```

---

### Step 3: Edge Functions

Three new edge functions in `supabase/functions/`:

**sync-portal/index.ts** (POST)
- Receives `{ clientLocalId, clientName, accessCode, data }`
- Generates 8-char random ID if new record, upserts into `client_portals`
- Uses service role key for writes
- Returns `{ id }`

**get-portal/index.ts** (GET `?id=xxx`)
- Fetches portal row by ID from `client_portals`
- Returns `{ data, accessCode, clientName }`

**upload-photo/index.ts** (POST)
- Receives `{ base64, taskId, photoId }`
- Uploads to `session-photos` bucket as `{taskId}/{photoId}.jpg`
- Returns `{ url }` (public URL)

All three include CORS headers and JWT verification disabled in config.toml.

---

### Step 4: Type Updates

**src/types/index.ts:**
- Add `portalId?: string` to `Client` interface
- Add `cloudUrl?: string` to `SessionPhoto` interface

---

### Step 5: Cloud Sync Utilities

**src/lib/clientPortalUtils.ts -- new exports:**
- `syncPortalToCloud(client, vehicles, tasks, defaultRate)` -- calls `sync-portal`, returns portal ID
- `fetchPortalFromCloud(portalId)` -- calls `get-portal`, returns `{ data, accessCode }`

**src/services/photoStorageService.ts -- new methods:**
- `compressImage(base64, maxWidth=800, quality=0.7)` -- canvas-based compression
- `uploadPhotoToCloud(base64, taskId, photoId)` -- calls `upload-photo`, returns public URL

---

### Step 6: Auto-Sync in Index.tsx

- After `handleCompleteWork`, call `syncPortalToCloud` in background (fire-and-forget)
- Store returned `portalId` on the client record
- After photo capture, also call `uploadPhotoToCloud`, save `cloudUrl` on the `SessionPhoto`
- All cloud calls wrapped in try/catch with silent failure

---

### Step 7: Short URL Sharing

**src/components/ManageClientsDialog.tsx (lines 576-628):**
- "Share Link" button now:
  1. If client has `portalId`, copy short URL: `{origin}/client-view?id={portalId}`
  2. If no `portalId`, trigger `syncPortalToCloud` first, then copy
  3. Fall back to current hash/file method if cloud sync fails
- PIN still shown alongside the link

---

### Step 8: Cloud-Aware Client Portal

**src/pages/ClientPortal.tsx:**
- Add check for `?id=` search param (cloud mode) as highest priority
- If present, call `fetchPortalFromCloud(id)` to load data
- Existing `#hash` and `/client/:id` paths remain as fallbacks

**src/components/ClientCostBreakdown.tsx:**
- Render session photos from cloud URLs when available in session data

---

### Implementation Order

1. Rename to "Auto-Tracker" (3 file edits)
2. Database migration (table + bucket + RLS)
3. Build 3 edge functions
4. Update types
5. Add cloud sync utilities + photo compression
6. Wire auto-sync into Index.tsx
7. Update sharing in ManageClientsDialog.tsx
8. Update ClientPortal.tsx for cloud fetch
9. Add photo rendering to ClientCostBreakdown

### Backward Compatibility

- Old hash links keep working
- HTML file fallback still available
- Local storage remains source of truth
- Cloud sync fails silently if offline


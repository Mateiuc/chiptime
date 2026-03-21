

# Fix: Client Portals Public Data Exposure

## Problem
The `client_portals` table has a wide-open SELECT policy (`true` for public), meaning anyone can query all client data directly via the Supabase REST API — names, access codes, financial data.

## Solution
Since the app already uses the `get-portal` edge function (with `verify_jwt = false`) to fetch portal data, and the `sync-portal` edge function uses the service role key for writes:

1. **Restrict the RLS SELECT policy** — change from public `true` to `USING (false)`, blocking all direct table reads.
2. **Update `get-portal` edge function** — switch from `SUPABASE_ANON_KEY` to `SUPABASE_SERVICE_ROLE_KEY` so the edge function bypasses RLS.
3. **Stop returning `accessCode` in the response** — instead, accept the PIN in the request and validate server-side. This prevents the access code from being exposed to the client at all.

## Detailed Changes

### Database Migration
```sql
DROP POLICY "Anyone can read portals" ON public.client_portals;
CREATE POLICY "No direct read access to portals"
ON public.client_portals FOR SELECT
USING (false);
```

### `supabase/functions/get-portal/index.ts`
- Use `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_ANON_KEY`
- Accept optional `code` query parameter
- If the portal has an `access_code`, require it to match before returning data
- Never return `accessCode` in the response — only return `requiresCode: true/false`

### `src/lib/clientPortalUtils.ts` — `fetchPortalFromCloud`
- First call: fetch with just the ID → get back `requiresCode` flag
- Second call (if code required): fetch with ID + code → get data

### `src/pages/ClientPortal.tsx`
- Adapt to two-step flow: load portal metadata first, then submit PIN server-side to unlock data

## Files to Change
1. Database migration — replace SELECT policy
2. `supabase/functions/get-portal/index.ts` — service role key + server-side PIN validation
3. `src/lib/clientPortalUtils.ts` — two-step fetch
4. `src/pages/ClientPortal.tsx` — adapt PIN flow


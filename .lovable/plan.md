## Fix: Lock down `client_portals` writes

**Problem:** `client_portals` has a SELECT policy (`USING: false`) but no INSERT/UPDATE/DELETE policies. With RLS enabled and no policies, writes are denied by default — but the scanner flags this as risky because the intent isn't explicit, and a future permissive policy could open it up.

**Context:** All legitimate writes to `client_portals` go through the `sync-portal` edge function, which uses the **service role key** (bypasses RLS entirely). No client-side code ever writes to this table directly. So the correct posture is: **explicitly deny all writes from anon/authenticated roles**.

### Migration

Add three explicit "deny" policies so the security posture is documented and enforced:

```sql
CREATE POLICY "No direct insert to portals"
ON public.client_portals FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No direct update to portals"
ON public.client_portals FOR UPDATE
TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete from portals"
ON public.client_portals FOR DELETE
TO authenticated, anon
USING (false);
```

Service-role writes (from the `sync-portal` edge function) continue to work because service role bypasses RLS.

### No code changes needed

`sync-portal/index.ts` already uses `SUPABASE_SERVICE_ROLE_KEY` — unaffected.

### Verification

- Portal sync from the app still works (creates/updates portal rows).
- Client portal access via `get-portal` still works.
- A direct write attempt from the browser (using the anon/JWT client) is rejected.

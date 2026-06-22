Two-part fix: restore worker names AND let each user set a short nickname.

### Part A — Fix missing name (root cause)
The `authenticated` role has no `SELECT` grant on `public.profiles` or `public.workspace_members`. Client queries silently return no rows, so `firstName` defaults to "—" and the chip shows only the dot.

Migration:
```sql
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text;
```

RLS already restricts who can read each row, so the grants are safe.

### Part B — Nickname editor
- `profiles.nickname` is the new column (short label, ~12 chars).
- In `WorkspaceManager.tsx` (the "Workspace & Account" dialog already used as the workers/settings panel), add:
  - For the **current user**: an inline input "Your nickname" that updates their own `profiles.nickname` (RLS already allows self-update).
  - For each **member row**: show the nickname after the name when present (e.g. `Ciprian Mateiuc · "Chip"`). Admins (owner/admin) get a pencil/inline input to edit other members' nicknames — requires a new RLS policy so admins can update co-members' profiles.

New policy:
```sql
CREATE POLICY "Workspace admins can update co-member profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workspace_members me
  JOIN public.workspace_members them ON me.workspace_id = them.workspace_id
  WHERE me.user_id = auth.uid()
    AND me.role IN ('owner','admin')
    AND them.user_id = profiles.id
))
WITH CHECK (true);
```

### Part C — Use nickname in chip
- Extend `ProfileRow` in `src/lib/workers.ts` to include `nickname`.
- `firstNameFrom(...)` becomes `labelFrom(nickname, display_name, email)` — prefer nickname, then first word of display_name, then email local-part.
- Chip already uses `worker.firstName`, no other changes needed.

### Out of scope
- No PDF/portal changes.
- No per-workspace overrides (nickname is global per user; sufficient for one-shop usage).
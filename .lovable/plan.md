## Goal
Show real member names (and emails) in the Workspace & Account dialog instead of truncated user-id hashes like `cd11787d…`.

## Why a small backend change is needed
Currently `WorkspaceManager` lists rows from `workspace_members`, which only stores `user_id`. The client cannot query `auth.users` directly, so there is no source for names/emails today. We need a readable `profiles` table.

## Changes

### 1. New migration — `profiles` table
- Create `public.profiles` with: `id uuid primary key references auth.users(id) on delete cascade`, `email text`, `display_name text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- `GRANT SELECT ON public.profiles TO authenticated; GRANT ALL TO service_role;` (no `anon`).
- `ENABLE ROW LEVEL SECURITY`.
- Policies:
  - Self: `auth.uid() = id` for SELECT/UPDATE.
  - Workspace visibility for SELECT: a member can see profiles of other users that share at least one workspace with them, via a SECURITY DEFINER helper `public.shares_workspace(_a uuid, _b uuid) returns boolean` that checks `workspace_members` (avoids RLS recursion).
- Trigger `handle_new_user()` (SECURITY DEFINER) on `auth.users` AFTER INSERT → inserts `id, email, raw_user_meta_data->>'full_name'` (fallback to `name` or email local-part) into `profiles`. Also update on email change.
- Backfill: `INSERT INTO public.profiles (id, email, display_name) SELECT id, email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)) FROM auth.users ON CONFLICT DO NOTHING;`

### 2. `src/components/WorkspaceManager.tsx`
- After loading `workspace_members`, fetch matching profiles: `supabase.from('profiles').select('id, email, display_name').in('id', memberIds)`.
- Render each member as: `display_name || email || 'Unknown'`, with the role on the right. Mark the current user with a trailing `(You)` instead of replacing the name.
- Keep the existing layout/styles; just swap the truncated id span for the resolved name (and a smaller muted email line if `display_name` exists and differs from email).

### Out of scope
- No change to invite flow, roles, or `AuthContext`.
- No editable profile UI (display_name stays as whatever was captured at signup; can be added later).

## Verification
- Open Workspace & Account on mobile: both members show as a real name or email, role on the right; current user shows `(You)`.
- New signups automatically appear with their name on next dialog open (trigger populates `profiles`).
- Security scan: `profiles` is RLS-protected, only visible to self or workspace co-members.

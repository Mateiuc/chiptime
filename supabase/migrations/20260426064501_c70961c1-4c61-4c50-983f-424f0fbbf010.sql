
-- Add workspace_id to app_sync
ALTER TABLE public.app_sync ADD COLUMN IF NOT EXISTS workspace_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS app_sync_workspace_id_unique ON public.app_sync(workspace_id) WHERE workspace_id IS NOT NULL;

-- Replace permissive policies with workspace-scoped ones
DROP POLICY IF EXISTS "Allow public read access to app_sync" ON public.app_sync;
DROP POLICY IF EXISTS "Allow public insert access to app_sync" ON public.app_sync;
DROP POLICY IF EXISTS "Allow public update access to app_sync" ON public.app_sync;

CREATE POLICY "Members can read their workspace sync"
ON public.app_sync FOR SELECT
USING (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert their workspace sync"
ON public.app_sync FOR INSERT
WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update their workspace sync"
ON public.app_sync FOR UPDATE
USING (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id));

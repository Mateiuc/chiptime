
ALTER TABLE public.client_portals
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Backfill workspace_id for existing rows using the single existing workspace member
UPDATE public.client_portals cp
SET workspace_id = (SELECT workspace_id FROM public.workspace_members ORDER BY created_at LIMIT 1)
WHERE cp.workspace_id IS NULL;

-- Drop the global unique on client_local_id; replace with (workspace_id, client_local_id)
ALTER TABLE public.client_portals DROP CONSTRAINT IF EXISTS client_portals_client_local_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS client_portals_workspace_client_local_id_key
  ON public.client_portals (workspace_id, client_local_id);
CREATE INDEX IF NOT EXISTS client_portals_workspace_id_idx
  ON public.client_portals (workspace_id);

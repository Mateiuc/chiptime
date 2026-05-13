ALTER TABLE public.app_sync ADD COLUMN IF NOT EXISTS data_version BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS app_sync_workspace_id_idx ON public.app_sync(workspace_id);
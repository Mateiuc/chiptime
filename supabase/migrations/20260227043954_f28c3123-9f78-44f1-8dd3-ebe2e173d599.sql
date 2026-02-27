CREATE TABLE public.app_sync (
  sync_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_sync" ON public.app_sync FOR SELECT USING (true);
CREATE POLICY "Anyone can insert app_sync" ON public.app_sync FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update app_sync" ON public.app_sync FOR UPDATE USING (true);
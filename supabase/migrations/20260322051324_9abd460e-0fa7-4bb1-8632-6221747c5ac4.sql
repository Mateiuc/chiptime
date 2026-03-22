DROP POLICY "Anyone can read app_sync" ON public.app_sync;
DROP POLICY "Anyone can insert app_sync" ON public.app_sync;
DROP POLICY "Anyone can update app_sync" ON public.app_sync;

CREATE POLICY "No direct access to app_sync" ON public.app_sync
  FOR ALL USING (false);
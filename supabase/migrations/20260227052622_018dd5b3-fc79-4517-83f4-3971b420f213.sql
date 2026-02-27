
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Anyone can insert app_sync" ON public.app_sync;
DROP POLICY IF EXISTS "Anyone can read app_sync" ON public.app_sync;
DROP POLICY IF EXISTS "Anyone can update app_sync" ON public.app_sync;

CREATE POLICY "Anyone can insert app_sync" ON public.app_sync
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read app_sync" ON public.app_sync
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update app_sync" ON public.app_sync
  AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true);

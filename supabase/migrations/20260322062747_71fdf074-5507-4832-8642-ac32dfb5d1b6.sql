DROP POLICY "No direct access to app_sync" ON public.app_sync;

CREATE POLICY "Allow public read access to app_sync"
ON public.app_sync FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to app_sync"
ON public.app_sync FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to app_sync"
ON public.app_sync FOR UPDATE USING (true);
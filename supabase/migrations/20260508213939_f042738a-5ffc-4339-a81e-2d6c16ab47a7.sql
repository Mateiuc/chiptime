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
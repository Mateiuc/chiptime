DROP POLICY "Anyone can read portals" ON public.client_portals;
CREATE POLICY "No direct read access to portals"
ON public.client_portals FOR SELECT
USING (false);
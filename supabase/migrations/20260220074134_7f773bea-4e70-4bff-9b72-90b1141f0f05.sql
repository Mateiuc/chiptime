
CREATE TABLE public.client_portals (
  id text PRIMARY KEY,
  client_local_id text UNIQUE NOT NULL,
  client_name text NOT NULL,
  access_code text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read portals"
  ON public.client_portals FOR SELECT USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('session-photos', 'session-photos', true, 5242880);

CREATE POLICY "Anyone can read session photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'session-photos');

CREATE POLICY "Service role can upload session photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'session-photos');

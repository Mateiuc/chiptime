INSERT INTO storage.buckets (id, name, public) VALUES ('vin-scan-failures', 'vin-scan-failures', false);

CREATE POLICY "Allow anon uploads to vin-scan-failures"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'vin-scan-failures');

CREATE POLICY "Allow anon select from vin-scan-failures"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'vin-scan-failures');
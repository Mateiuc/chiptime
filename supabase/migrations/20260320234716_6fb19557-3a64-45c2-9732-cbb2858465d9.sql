INSERT INTO storage.buckets (id, name, public) VALUES ('diagnostic-pdfs', 'diagnostic-pdfs', true);

CREATE POLICY "Anyone can read diagnostic PDFs" ON storage.objects FOR SELECT TO public USING (bucket_id = 'diagnostic-pdfs');
CREATE POLICY "Anyone can upload diagnostic PDFs" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'diagnostic-pdfs');
CREATE POLICY "Anyone can update diagnostic PDFs" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'diagnostic-pdfs');
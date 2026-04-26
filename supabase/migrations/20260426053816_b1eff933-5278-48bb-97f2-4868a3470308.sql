
-- =============================================================
-- Storage hardening: make all buckets private and restrict policies
-- =============================================================

-- 1) Make all buckets private. App reads files via edge functions
--    (sign-photo-urls, sign-diagnostic-url, get-portal) which use the
--    service-role key to mint short-lived signed URLs.
UPDATE storage.buckets SET public = false WHERE id IN ('session-photos', 'diagnostic-pdfs', 'vin-scan-failures');

-- 2) Drop all existing permissive policies for these three buckets.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        policyname ILIKE '%session photos%'
        OR policyname ILIKE '%session_photos%'
        OR policyname ILIKE '%session-photos%'
        OR policyname ILIKE '%diagnostic pdf%'
        OR policyname ILIKE '%diagnostic-pdf%'
        OR policyname ILIKE '%diagnostic_pdf%'
        OR policyname ILIKE '%vin-scan-failures%'
        OR policyname ILIKE '%vin_scan_failures%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3) No anon/authenticated policies are created. The service-role key
--    used by the app's edge functions (upload-photo, upload-diagnostic,
--    sign-photo-urls, sign-diagnostic-url, get-portal, VinScanner failure
--    capture) bypasses RLS, so these buckets remain fully functional
--    while being completely closed off to direct REST access.
--
--    This eliminates:
--      - Public listing/reading of session photos and diagnostic PDFs
--      - Anonymous uploads/overwrites of diagnostic PDFs (integrity attack)
--      - Anonymous read/upload to the supposedly-private vin-scan-failures

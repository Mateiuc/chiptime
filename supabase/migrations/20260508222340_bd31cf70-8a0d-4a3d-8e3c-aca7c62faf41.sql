
-- 1. Block direct writes on workspace_members (managed via create_workspace / redeem_workspace_invite RPCs which run as SECURITY DEFINER)
CREATE POLICY "No direct insert to workspace_members"
ON public.workspace_members FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "No direct update to workspace_members"
ON public.workspace_members FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete from workspace_members"
ON public.workspace_members FOR DELETE TO authenticated, anon USING (false);

-- 2. Block direct writes on workspaces (managed via create_workspace / claim_unclaimed_workspace RPCs)
CREATE POLICY "No direct insert to workspaces"
ON public.workspaces FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "No direct update to workspaces"
ON public.workspaces FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete from workspaces"
ON public.workspaces FOR DELETE TO authenticated, anon USING (false);

-- 3. Block direct UPDATE on workspace_invites (consumed via redeem_workspace_invite RPC)
CREATE POLICY "No direct update to workspace_invites"
ON public.workspace_invites FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

-- 4. Storage policies — workspace-scoped access on private buckets.
--    Path convention: first folder = workspace_id (uuid).

-- session-photos
CREATE POLICY "Workspace members can read session-photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'session-photos'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can upload session-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'session-photos'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can update session-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'session-photos'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can delete session-photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'session-photos'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- diagnostic-pdfs
CREATE POLICY "Workspace members can read diagnostic-pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diagnostic-pdfs'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can upload diagnostic-pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diagnostic-pdfs'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can update diagnostic-pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'diagnostic-pdfs'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can delete diagnostic-pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'diagnostic-pdfs'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- vin-scan-failures (uploaded directly from client by VinScanner)
CREATE POLICY "Workspace members can read vin-scan-failures"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vin-scan-failures'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can upload vin-scan-failures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vin-scan-failures'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can update vin-scan-failures"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vin-scan-failures'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Workspace members can delete vin-scan-failures"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vin-scan-failures'
  AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

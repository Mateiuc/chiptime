GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;

CREATE POLICY "Workspace admins can update co-member profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workspace_members me
  JOIN public.workspace_members them ON me.workspace_id = them.workspace_id
  WHERE me.user_id = auth.uid()
    AND me.role IN ('owner','admin')
    AND them.user_id = profiles.id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workspace_members me
  JOIN public.workspace_members them ON me.workspace_id = them.workspace_id
  WHERE me.user_id = auth.uid()
    AND me.role IN ('owner','admin')
    AND them.user_id = profiles.id
));
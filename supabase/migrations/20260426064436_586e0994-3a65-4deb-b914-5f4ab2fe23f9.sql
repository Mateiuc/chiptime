
-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_unclaimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

-- Members table
CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Invites table
CREATE TABLE public.workspace_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  used_by UUID
);

-- Helper: check if user is a member of a workspace (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Returns the user's first/primary workspace id
CREATE OR REPLACE FUNCTION public.user_primary_workspace(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- workspaces policies
CREATE POLICY "Members can view their workspaces"
ON public.workspaces FOR SELECT
USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Anyone authenticated can view unclaimed workspaces"
ON public.workspaces FOR SELECT
USING (is_unclaimed = true AND auth.uid() IS NOT NULL);

-- workspace_members policies
CREATE POLICY "Users can view members of their workspaces"
ON public.workspace_members FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- workspace_invites policies
CREATE POLICY "Admins can view invites of their workspaces"
ON public.workspace_invites FOR SELECT
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can create invites"
ON public.workspace_invites FOR INSERT
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can delete invites"
ON public.workspace_invites FOR DELETE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- RPC: create workspace and make caller the owner
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.workspaces (name) VALUES (_name) RETURNING id INTO _ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_ws_id, _uid, 'owner');
  RETURN _ws_id;
END;
$$;

-- RPC: redeem an invite code -> add caller as member
CREATE OR REPLACE FUNCTION public.redeem_workspace_invite(_code TEXT)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO _inv FROM public.workspace_invites
    WHERE code = _code AND used_at IS NULL
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already-used invite code';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_inv.workspace_id, _uid, _inv.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  UPDATE public.workspace_invites
    SET used_at = now(), used_by = _uid
    WHERE id = _inv.id;
  RETURN _inv.workspace_id;
END;
$$;

-- RPC: claim an unclaimed workspace as owner
CREATE OR REPLACE FUNCTION public.claim_unclaimed_workspace()
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO _ws_id FROM public.workspaces
    WHERE is_unclaimed = true
    ORDER BY created_at ASC
    LIMIT 1;
  IF _ws_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.workspaces SET is_unclaimed = false WHERE id = _ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_ws_id, _uid, 'owner')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  RETURN _ws_id;
END;
$$;

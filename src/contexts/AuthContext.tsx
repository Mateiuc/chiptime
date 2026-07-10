import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { appSyncService } from '@/services/appSyncService';
import type { Session, User } from '@supabase/supabase-js';

interface WorkspaceInfo {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  workspace: WorkspaceInfo | null;
  workspaceReady: boolean;
  workspaceLoadError: string | null;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tryLoadOnce = useCallback(async (uid: string): Promise<{ ws: WorkspaceInfo | null; error: string | null }> => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, workspace_id, workspaces(id, name)')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[Auth] workspace_members select failed:', error.code, error.message, error.details, error.hint);
      return { ws: null, error: `${error.code || 'err'}: ${error.message}` };
    }
    if (data) {
      const ws = (data as any).workspaces;
      if (ws) return { ws: { id: ws.id, name: ws.name, role: (data as any).role }, error: null };
    }
    const { data: wsId, error: rpcErr } = await supabase.rpc('user_primary_workspace', { _user_id: uid });
    if (rpcErr) {
      console.error('[Auth] user_primary_workspace RPC failed:', rpcErr.message);
      return { ws: null, error: `rpc: ${rpcErr.message}` };
    }
    if (wsId) {
      const { data: wsRow, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', wsId as string)
        .maybeSingle();
      if (wsErr) {
        console.error('[Auth] workspaces select failed:', wsErr.message);
        return { ws: null, error: `ws: ${wsErr.message}` };
      }
      if (wsRow) return { ws: { id: wsRow.id, name: wsRow.name, role: 'member' }, error: null };
    }
    return { ws: null, error: null };
  }, []);

  const loadWorkspace = useCallback(async (uid: string | null) => {
    setWorkspaceReady(false);
    setWorkspaceLoadError(null);
    if (!uid) {
      setWorkspace(null);
      appSyncService.setWorkspaceId(null);
      setWorkspaceReady(true);
      return;
    }
    let result = await tryLoadOnce(uid);
    if (!result.ws) {
      await new Promise(r => setTimeout(r, 400));
      result = await tryLoadOnce(uid);
    }
    if (result.ws) {
      setWorkspace(result.ws);
      appSyncService.setWorkspaceId(result.ws.id);
    } else {
      setWorkspace(null);
      appSyncService.setWorkspaceId(null);
      setWorkspaceLoadError(result.error);
    }
    setWorkspaceReady(true);
  }, [tryLoadOnce]);

  useEffect(() => {
    // 1) Subscribe FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Defer Supabase calls to avoid deadlock inside the callback
      setTimeout(() => {
        loadWorkspace(newSession?.user?.id ?? null);
      }, 0);
    });
    // 2) Then fetch existing session
    supabase.auth.getSession()
      .then(({ data: { session: existing } }) => {
        setSession(existing);
        setUser(existing?.user ?? null);
        loadWorkspace(existing?.user?.id ?? null).finally(() => setLoading(false));
      })
      .catch(err => {
        // Don't leave the app stuck on a loading splash if auth fetch fails.
        console.error('[Auth] Failed to fetch existing session:', err);
        setLoading(false);
      });
    return () => sub.subscription.unsubscribe();
  }, [loadWorkspace]);

  const refreshWorkspace = useCallback(async () => {
    await loadWorkspace(user?.id ?? null);
  }, [user, loadWorkspace]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    appSyncService.setWorkspaceId(null);
    localStorage.removeItem('app_sync_local_updated_at');
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, workspace, workspaceReady, workspaceLoadError, loading, refreshWorkspace, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
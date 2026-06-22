import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Copy, LogOut, Plus, Trash2, Loader2, Pencil, Check, X } from 'lucide-react';

interface InviteRow {
  id: string;
  code: string;
  role: string;
  created_at: string;
  used_at: string | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out.slice(0, 4) + '-' + out.slice(4);
}

export const WorkspaceManager = ({ open, onOpenChange }: Props) => {
  const { workspace, user, signOut } = useAuth();
  const { toast } = useNotifications();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const isAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    const [inv, mem] = await Promise.all([
      supabase.from('workspace_invites').select('id, code, role, created_at, used_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('workspace_members').select('user_id, role, created_at').eq('workspace_id', workspace.id).order('created_at'),
    ]);
    const memberRows: MemberRow[] = (mem.data as any) || [];
    setInvites((inv.data as any) || []);
    setMembers(memberRows);
    const ids = memberRows.map(m => m.user_id);
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', ids);
      const map: Record<string, ProfileRow> = {};
      ((profs as any) || []).forEach((p: ProfileRow) => { map[p.id] = p; });
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, workspace?.id]);

  const createInvite = async () => {
    if (!workspace || !user) return;
    setCreating(true);
    try {
      const code = generateInviteCode();
      const { error } = await supabase.from('workspace_invites').insert({
        workspace_id: workspace.id,
        code,
        role: 'member',
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'Invite created', description: code });
      load();
    } catch (e: any) {
      toast({ title: 'Could not create invite', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteInvite = async (id: string) => {
    const { error } = await supabase.from('workspace_invites').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workspace & Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="font-medium text-sm">{user?.email}</div>
            <div className="text-xs text-muted-foreground mt-2">Workspace</div>
            <div className="font-medium text-sm">{workspace?.name} <span className="text-xs text-muted-foreground">({workspace?.role})</span></div>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Invite codes</Label>
                <Button size="sm" onClick={createInvite} disabled={creating}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> New</>}
                </Button>
              </div>
              {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
              {!loading && invites.length === 0 && (
                <div className="text-xs text-muted-foreground">No invite codes yet. Create one to invite a team member.</div>
              )}
              <div className="space-y-1.5">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-sm">
                    <div className="flex flex-col">
                      <span className="font-mono">{inv.code}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {inv.used_at ? `Used ${new Date(inv.used_at).toLocaleDateString()}` : 'Not used'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" aria-label="Copy invite code" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(inv.code); toast({ title: 'Copied' }); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Delete invite" className="h-7 w-7 text-destructive" onClick={() => deleteInvite(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Members ({members.length})</Label>
            <div className="space-y-1.5">
              {members.map((m) => {
                const p = profiles[m.user_id];
                const name = p?.display_name || p?.email || 'Unknown user';
                const showEmail = !!(p?.display_name && p?.email && p.display_name !== p.email);
                const isYou = m.user_id === user?.id;
                return (
                  <div key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {name}{isYou && <span className="text-xs text-muted-foreground font-normal"> (You)</span>}
                      </div>
                      {showEmail && (
                        <div className="text-[11px] text-muted-foreground truncate">{p!.email}</div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{m.role}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={async () => { await signOut(); window.location.href = '/auth'; }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
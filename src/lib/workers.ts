import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WorkerDisplay {
  id: string;
  firstName: string;
  fullName: string;
  email: string | null;
  color: string;   // solid color (text + dot)
  bg: string;      // translucent background
  border: string;  // translucent border
}

const UNKNOWN: WorkerDisplay = {
  id: '',
  firstName: '—',
  fullName: 'Unknown',
  email: null,
  color: 'hsl(0 0% 50%)',
  bg: 'hsl(0 0% 50% / 0.15)',
  border: 'hsl(0 0% 50% / 0.35)',
};

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

function makeColors(uid: string) {
  const hue = hashString(uid) % 360;
  return {
    color: `hsl(${hue} 65% 42%)`,
    bg: `hsl(${hue} 70% 50% / 0.15)`,
    border: `hsl(${hue} 70% 45% / 0.45)`,
  };
}

function firstNameFrom(displayName: string | null | undefined, email: string | null | undefined): string {
  const dn = (displayName || '').trim();
  if (dn) return dn.split(/\s+/)[0];
  const em = (email || '').trim();
  if (em) return em.split('@')[0];
  return '—';
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

/**
 * Loads all profiles for members of the current workspace.
 * Returns a getter that resolves a user_id to a WorkerDisplay.
 */
export function useWorkers() {
  const { workspace } = useAuth();
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workspace) { setProfiles({}); return; }
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace.id);
      const ids = ((members as any) || []).map((m: any) => m.user_id);
      if (ids.length === 0) { if (!cancelled) setProfiles({}); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', ids);
      if (cancelled) return;
      const map: Record<string, ProfileRow> = {};
      ((profs as any) || []).forEach((p: ProfileRow) => { map[p.id] = p; });
      setProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [workspace?.id]);

  const getWorker = (uid?: string | null): WorkerDisplay => {
    if (!uid) return UNKNOWN;
    const p = profiles[uid];
    const colors = makeColors(uid);
    return {
      id: uid,
      firstName: firstNameFrom(p?.display_name, p?.email),
      fullName: p?.display_name || p?.email || 'Unknown',
      email: p?.email || null,
      ...colors,
    };
  };

  const allWorkers = (): WorkerDisplay[] =>
    Object.values(profiles).map(p => ({
      id: p.id,
      firstName: firstNameFrom(p.display_name, p.email),
      fullName: p.display_name || p.email || 'Unknown',
      email: p.email,
      ...makeColors(p.id),
    }));

  return { getWorker, allWorkers, profiles };
}

import { Client, Vehicle, Task, Settings } from '@/types';

const FIXED_SYNC_ID = 'chiptime-default';
const LOCAL_UPDATED_AT_KEY = 'app_sync_local_updated_at';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SyncData {
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
}

async function callSyncFunction(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `sync-data returned ${res.status}`);
  }

  return res.json();
}

export const appSyncService = {
  getSyncId(): string {
    return FIXED_SYNC_ID;
  },

  getLocalUpdatedAt(): string | null {
    return localStorage.getItem(LOCAL_UPDATED_AT_KEY);
  },

  setLocalUpdatedAt(ts: string) {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, ts);
  },

  async pushToCloud(data: SyncData): Promise<void> {
    const syncKey = this.getSyncId();
    const result = await callSyncFunction({ action: 'push', sync_key: syncKey, data });
    const now = result.updated_at;
    this.setLocalUpdatedAt(now);
    console.log('[AppSync] Pushed to cloud at', now);
  },

  async pullFromCloud(): Promise<{ data: SyncData; updatedAt: string } | null> {
    const syncKey = this.getSyncId();
    const result = await callSyncFunction({ action: 'pull', sync_key: syncKey });

    if (!result.record) {
      console.log('[AppSync] No remote data found for sync_key:', syncKey);
      return null;
    }

    const syncData = result.record.data as unknown as SyncData;
    console.log('[AppSync] Pulled from cloud, updated_at:', result.record.updated_at);
    return { data: syncData, updatedAt: result.record.updated_at };
  },

  async getRemoteUpdatedAt(): Promise<string | null> {
    const syncKey = this.getSyncId();
    const result = await callSyncFunction({ action: 'check', sync_key: syncKey });
    return result.updated_at || null;
  },

  isRemoteNewer(remoteUpdatedAt: string | null): boolean {
    if (!remoteUpdatedAt) return false;
    const localUpdatedAt = this.getLocalUpdatedAt();
    if (!localUpdatedAt) return true;
    return new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
  },
};

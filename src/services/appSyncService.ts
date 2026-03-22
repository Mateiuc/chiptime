import { supabase } from '@/integrations/supabase/client';
import { Client, Vehicle, Task, Settings } from '@/types';

const FIXED_SYNC_ID = 'chiptime-default';
const LOCAL_UPDATED_AT_KEY = 'app_sync_local_updated_at';

export interface SyncData {
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
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
    const syncId = this.getSyncId();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('app_sync')
      .upsert({
        sync_id: syncId,
        data: data as any,
        updated_at: now,
      }, { onConflict: 'sync_id' });

    if (error) {
      console.error('[AppSync] Push failed:', error);
      throw error;
    }

    this.setLocalUpdatedAt(now);
    console.log('[AppSync] Pushed to cloud at', now);
  },

  async pullFromCloud(): Promise<{ data: SyncData; updatedAt: string } | null> {
    const syncId = this.getSyncId();

    const { data, error } = await supabase
      .from('app_sync')
      .select('data, updated_at')
      .eq('sync_id', syncId)
      .maybeSingle();

    if (error) {
      console.error('[AppSync] Pull failed:', error);
      throw error;
    }

    if (!data) {
      console.log('[AppSync] No remote data found for sync_id:', syncId);
      return null;
    }

    const syncData = data.data as unknown as SyncData;
    console.log('[AppSync] Pulled from cloud, updated_at:', data.updated_at);
    return { data: syncData, updatedAt: data.updated_at };
  },

  async getRemoteUpdatedAt(): Promise<string | null> {
    const syncId = this.getSyncId();

    const { data, error } = await supabase
      .from('app_sync')
      .select('updated_at')
      .eq('sync_id', syncId)
      .maybeSingle();

    if (error) {
      console.error('[AppSync] Failed to get remote updated_at:', error);
      return null;
    }

    return data?.updated_at || null;
  },

  isRemoteNewer(remoteUpdatedAt: string | null): boolean {
    if (!remoteUpdatedAt) return false;
    const localUpdatedAt = this.getLocalUpdatedAt();
    if (!localUpdatedAt) return true;
    return new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
  },
};

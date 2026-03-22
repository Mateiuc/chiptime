import { supabase } from '@/integrations/supabase/client';
import { Client, Vehicle, Task, Settings } from '@/types';

const SYNC_KEY_STORAGE_KEY = 'chiptime_sync_key';
const LOCAL_UPDATED_AT_KEY = 'app_sync_local_updated_at';
const OLD_FIXED_SYNC_ID = 'chiptime-default';

function generateSyncKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export interface SyncData {
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
}

export const appSyncService = {
  getSyncId(): string {
    let key = localStorage.getItem(SYNC_KEY_STORAGE_KEY);
    if (!key) {
      key = generateSyncKey();
      localStorage.setItem(SYNC_KEY_STORAGE_KEY, key);
    }
    return key;
  },

  setSyncId(key: string) {
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, key);
    // Clear local updated_at so next sync pulls fresh from cloud
    localStorage.removeItem(LOCAL_UPDATED_AT_KEY);
  },

  hasSyncKey(): boolean {
    return !!localStorage.getItem(SYNC_KEY_STORAGE_KEY);
  },

  getLocalUpdatedAt(): string | null {
    return localStorage.getItem(LOCAL_UPDATED_AT_KEY);
  },

  setLocalUpdatedAt(ts: string) {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, ts);
  },

  /**
   * One-time migration: if the old hardcoded 'chiptime-default' row exists
   * and the user has no sync key yet, generate a new key, update the row's
   * sync_id to the new key, and store the key locally.
   */
  async migrateFromFixedId(): Promise<void> {
    // Only run if user has no key yet
    if (localStorage.getItem(SYNC_KEY_STORAGE_KEY)) return;

    const { data, error } = await supabase
      .from('app_sync')
      .select('sync_id, updated_at')
      .eq('sync_id', OLD_FIXED_SYNC_ID)
      .maybeSingle();

    if (error || !data) return;

    const newKey = generateSyncKey();

    // Update the row's sync_id to the new secret key
    const { error: updateError } = await supabase
      .from('app_sync')
      .update({ sync_id: newKey })
      .eq('sync_id', OLD_FIXED_SYNC_ID);

    if (updateError) {
      console.error('[AppSync] Migration failed:', updateError);
      return;
    }

    localStorage.setItem(SYNC_KEY_STORAGE_KEY, newKey);
    this.setLocalUpdatedAt(data.updated_at);
    console.log('[AppSync] Migrated from fixed sync_id to secret key');
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
      console.log('[AppSync] No remote data found for sync_id');
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

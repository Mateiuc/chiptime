import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';
import { Client, Vehicle, Task, Settings } from '@/types';

const SYNC_KEY = 'chiptime_sync_key';
const LOCAL_UPDATED_AT_KEY = 'app_sync_local_updated_at';
const OLD_FIXED_SYNC_ID = 'chiptime-default';

function generateSyncKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** One-time: migrate sync metadata from localStorage → Preferences */
async function migrateLocalStorageToPreferences(): Promise<void> {
  const { value: existing } = await Preferences.get({ key: SYNC_KEY });
  if (existing) return; // already in Preferences

  const lsKey = localStorage.getItem(SYNC_KEY);
  if (lsKey) {
    await Preferences.set({ key: SYNC_KEY, value: lsKey });
    localStorage.removeItem(SYNC_KEY);
  }

  const { value: existingTs } = await Preferences.get({ key: LOCAL_UPDATED_AT_KEY });
  if (!existingTs) {
    const lsTs = localStorage.getItem(LOCAL_UPDATED_AT_KEY);
    if (lsTs) {
      await Preferences.set({ key: LOCAL_UPDATED_AT_KEY, value: lsTs });
      localStorage.removeItem(LOCAL_UPDATED_AT_KEY);
    }
  }
}

async function invokeSync(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('sync-data', { body });
  if (error) {
    console.error('[AppSync] Edge function error:', error);
    throw error;
  }
  return data;
}

export interface SyncData {
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
}

export const appSyncService = {
  async getSyncId(): Promise<string> {
    await migrateLocalStorageToPreferences();
    const { value } = await Preferences.get({ key: SYNC_KEY });
    if (value) return value;

    const newKey = generateSyncKey();
    await Preferences.set({ key: SYNC_KEY, value: newKey });
    return newKey;
  },

  async setSyncId(key: string): Promise<void> {
    await Preferences.set({ key: SYNC_KEY, value: key });
    // Clear local updated_at so next sync pulls fresh from cloud
    await Preferences.remove({ key: LOCAL_UPDATED_AT_KEY });
  },

  async hasSyncKey(): Promise<boolean> {
    await migrateLocalStorageToPreferences();
    const { value } = await Preferences.get({ key: SYNC_KEY });
    return !!value;
  },

  async getLocalUpdatedAt(): Promise<string | null> {
    const { value } = await Preferences.get({ key: LOCAL_UPDATED_AT_KEY });
    return value;
  },

  async setLocalUpdatedAt(ts: string): Promise<void> {
    await Preferences.set({ key: LOCAL_UPDATED_AT_KEY, value: ts });
  },

  /**
   * One-time migration: if the old hardcoded 'chiptime-default' row exists
   * and the user has no sync key yet, generate a new key, update the row's
   * sync_id to the new key, and store the key locally.
   */
  async migrateFromFixedId(): Promise<void> {
    await migrateLocalStorageToPreferences();

    const { value: existingKey } = await Preferences.get({ key: SYNC_KEY });
    if (existingKey) return;

    const newKey = generateSyncKey();

    const result = await invokeSync({
      action: 'migrate',
      old_sync_id: OLD_FIXED_SYNC_ID,
      new_sync_id: newKey,
    });

    if (!result?.found) return;

    await Preferences.set({ key: SYNC_KEY, value: newKey });
    await this.setLocalUpdatedAt(result.updated_at);
    console.log('[AppSync] Migrated from fixed sync_id to secret key');
  },

  async pushToCloud(data: SyncData): Promise<void> {
    const syncId = await this.getSyncId();

    const result = await invokeSync({
      action: 'push',
      sync_id: syncId,
      data,
    });

    await this.setLocalUpdatedAt(result.updated_at);
    console.log('[AppSync] Pushed to cloud at', result.updated_at);
  },

  async pullFromCloud(): Promise<{ data: SyncData; updatedAt: string } | null> {
    const syncId = await this.getSyncId();

    const result = await invokeSync({
      action: 'pull',
      sync_id: syncId,
    });

    if (!result?.data) {
      console.log('[AppSync] No remote data found for sync_id');
      return null;
    }

    const syncData = result.data as SyncData;
    console.log('[AppSync] Pulled from cloud, updated_at:', result.updated_at);
    return { data: syncData, updatedAt: result.updated_at };
  },

  async getRemoteUpdatedAt(): Promise<string | null> {
    const syncId = await this.getSyncId();

    const result = await invokeSync({
      action: 'check',
      sync_id: syncId,
    });

    return result?.updated_at || null;
  },

  async isRemoteNewer(remoteUpdatedAt: string | null): Promise<boolean> {
    if (!remoteUpdatedAt) return false;
    const localUpdatedAt = await this.getLocalUpdatedAt();
    if (!localUpdatedAt) return true;
    return new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
  },
};

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Client, Vehicle, Task, Settings } from '@/types';
import { dlog } from '@/lib/devLog';

const LOCAL_UPDATED_AT_KEY = 'app_sync_local_updated_at';
const LOCAL_WORKSPACE_KEY = 'app_sync_workspace_id';

export interface SyncData {
  clients: Client[];
  vehicles: Vehicle[];
  tasks: Task[];
  settings: Settings;
}

/**
 * Thrown when the cloud row's `data_version` no longer matches the version
 * we believed the local snapshot was based on. The caller (useStorage hook)
 * is responsible for fetching `remoteData`, merging with local, and retrying.
 */
export class VersionConflictError extends Error {
  remoteData: SyncData;
  remoteVersion: number;
  remoteUpdatedAt: string;
  constructor(remoteData: SyncData, remoteVersion: number, remoteUpdatedAt: string) {
    super('app_sync version conflict');
    this.name = 'VersionConflictError';
    this.remoteData = remoteData;
    this.remoteVersion = remoteVersion;
    this.remoteUpdatedAt = remoteUpdatedAt;
  }
}

const isObj = (x: any) => x && typeof x === 'object' && !Array.isArray(x);

function normalizeRaw(raw: any): SyncData {
  return {
    ...(raw || {}),
    tasks: Array.isArray(raw?.tasks) ? raw.tasks.filter((t: any) => isObj(t) && t.id) : [],
    clients: Array.isArray(raw?.clients) ? raw.clients.filter((c: any) => isObj(c) && c.id) : [],
    vehicles: Array.isArray(raw?.vehicles) ? raw.vehicles.filter((v: any) => isObj(v) && v.id) : [],
    settings: raw?.settings || { defaultHourlyRate: 75 },
  };
}

function sanitizeForCloud(data: SyncData): SyncData {
  return {
    ...data,
    // SECURITY: Strip per-client access codes before syncing. They live only
    // in the cloud `client_portals` table (server-validated) and on each
    // device locally. They must never be uploaded to a JSON sync blob.
    clients: (data.clients || []).map((c: any) => {
      const { accessCode: _omit, ...rest } = c || {};
      return rest;
    }),
    // SECURITY: Strip third-party API keys (Gemini/Grok/OCR Space) before
    // syncing. These are device-local OCR credentials and must never be
    // synced to the cloud or shared across workspace members.
    settings: (() => {
      const s: any = { ...(data.settings || {}) };
      delete s.googleApiKey;
      delete s.grokApiKey;
      delete s.ocrSpaceApiKey;
      return s;
    })(),
  };
}

// In-memory cache of the latest server data_version we successfully read or
// wrote. Used as the `expectedVersion` for the next conditional update.
// Module-local; reset on full reload (which is fine — pushToCloud will
// re-seed it via getRemoteVersion).
let lastKnownVersion: number | null = null;

// In-memory cache of the latest server snapshot we've successfully read or
// written. Used as the BASE for 3-way conflict reconciliation in
// useStorage.mergeOnConflict — a true overlap requires both local and
// remote to have diverged from this base.
let baseSnapshot: SyncData | null = null;
const cloneSnap = (s: SyncData): SyncData => {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(s)
      : JSON.parse(JSON.stringify(s));
  } catch {
    return JSON.parse(JSON.stringify(s));
  }
};

export const appSyncService = {
  getWorkspaceId(): string | null {
    return localStorage.getItem(LOCAL_WORKSPACE_KEY);
  },

  setWorkspaceId(id: string | null) {
    if (id) localStorage.setItem(LOCAL_WORKSPACE_KEY, id);
    else localStorage.removeItem(LOCAL_WORKSPACE_KEY);
    // New workspace context — drop the cached version so the next push
    // re-fetches from the new row.
    lastKnownVersion = null;
    baseSnapshot = null;
  },

  getLocalUpdatedAt(): string | null {
    return localStorage.getItem(LOCAL_UPDATED_AT_KEY);
  },

  setLocalUpdatedAt(ts: string) {
    try {
      localStorage.setItem(LOCAL_UPDATED_AT_KEY, ts);
    } catch (e) {
      // Safari private mode / quota exceeded — non-fatal.
      console.warn('[AppSync] Failed to persist updated_at:', e);
    }
  },

  getLastKnownVersion(): number | null {
    return lastKnownVersion;
  },

  /**
   * Last server snapshot we observed (via pull or successful push).
   * Consumed by useStorage.mergeOnConflict for 3-way diffing. Returns
   * `null` before the first pull/push of a session.
   */
  getBaseSnapshot(): SyncData | null {
    return baseSnapshot;
  },

  /**
   * Lightweight version-only fetch for the post-deploy bootstrap path —
   * avoids pulling the whole data blob just to seed `lastKnownVersion`.
   */
  async getRemoteVersion(): Promise<number | null> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) return null;
    const { data, error } = await supabase
      .from('app_sync')
      .select('data_version')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) {
      console.error('[AppSync] getRemoteVersion failed:', error);
      return null;
    }
    if (!data) return null;
    const v = Number(data.data_version ?? 0);
    return Number.isFinite(v) ? v : 0;
  },

  /**
   * Pushes `data` to the cloud using optimistic concurrency.
   * On version mismatch throws `VersionConflictError` carrying the fresh
   * remote payload + version so the caller can reconcile and retry.
   */
  async pushToCloud(data: SyncData): Promise<{ version: number; updatedAt: string } | void> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      console.warn('[AppSync] Skipped push — no workspace');
      return;
    }
    const sanitized = sanitizeForCloud(data);

    // Seed `lastKnownVersion` if this is a fresh tab / post-deploy push.
    if (lastKnownVersion === null) {
      lastKnownVersion = await this.getRemoteVersion();
    }

    // Case A: row exists — conditional UPDATE on data_version.
    if (lastKnownVersion !== null) {
      const { data: updated, error } = await supabase
        .from('app_sync')
        .update({
          data: sanitized as unknown as Json,
          data_version: lastKnownVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('data_version', lastKnownVersion)
        .select('data_version, updated_at')
        .maybeSingle();

      if (error) {
        console.error('[AppSync] Conditional update failed:', error);
        throw error;
      }

      if (updated) {
        const newVersion = Number(updated.data_version);
        const newUpdatedAt = String(updated.updated_at);
        lastKnownVersion = newVersion;
        baseSnapshot = cloneSnap(sanitized);
        this.setLocalUpdatedAt(newUpdatedAt);
        dlog('[AppSync] Pushed v' + newVersion + ' at', newUpdatedAt);
        return { version: newVersion, updatedAt: newUpdatedAt };
      }

      // 0 rows updated → either version mismatch, or row vanished.
      const fresh = await this.pullFromCloud();
      if (fresh) {
        throw new VersionConflictError(fresh.data, fresh.version, fresh.updatedAt);
      }
      // Row truly missing — fall through to insert path.
      lastKnownVersion = null;
    }

    // Case B: no row yet — insert a fresh one at version 1.
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from('app_sync')
      .insert({
        sync_id: workspaceId,
        workspace_id: workspaceId,
        data: sanitized as unknown as Json,
        data_version: 1,
        updated_at: now,
      })
      .select('data_version, updated_at')
      .maybeSingle();

    if (insertErr) {
      // Unique-violation (someone else inserted concurrently) — re-seed
      // and let the caller retry on the next mutation.
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        lastKnownVersion = await this.getRemoteVersion();
        const fresh = await this.pullFromCloud();
        if (fresh) {
          throw new VersionConflictError(fresh.data, fresh.version, fresh.updatedAt);
        }
      }
      console.error('[AppSync] Insert failed:', insertErr);
      throw insertErr;
    }

    if (inserted) {
      const newVersion = Number(inserted.data_version);
      const newUpdatedAt = String(inserted.updated_at);
      lastKnownVersion = newVersion;
      baseSnapshot = cloneSnap(sanitized);
      this.setLocalUpdatedAt(newUpdatedAt);
      dlog('[AppSync] Inserted v' + newVersion + ' at', newUpdatedAt);
      return { version: newVersion, updatedAt: newUpdatedAt };
    }
  },

  async pullFromCloud(): Promise<{ data: SyncData; updatedAt: string; version: number } | null> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) return null;

    const { data, error } = await supabase
      .from('app_sync')
      .select('data, updated_at, data_version')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('[AppSync] Pull failed:', error);
      throw error;
    }

    if (!data) {
      dlog('[AppSync] No remote data found for workspace:', workspaceId);
      return null;
    }

    const syncData = normalizeRaw(data.data || {});
    const version = Number(data.data_version ?? 0);
    lastKnownVersion = version;
    baseSnapshot = cloneSnap(syncData);
    dlog('[AppSync] Pulled v' + version + ', updated_at:', data.updated_at);
    return { data: syncData, updatedAt: data.updated_at, version };
  },

  async getRemoteUpdatedAt(): Promise<string | null> {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) return null;

    const { data, error } = await supabase
      .from('app_sync')
      .select('updated_at')
      .eq('workspace_id', workspaceId)
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

  /**
   * SAFE per-task patch (desktop = secondary; mobile = master).
   *
   * Instead of pushing the entire local snapshot — which can clobber a
   * mobile Stop/Save that landed in between — this:
   *   1. Pulls fresh cloud data.
   *   2. Applies `updates` to ONLY the named task id (shallow merge).
   *   3. Pushes the modified snapshot back with the optimistic version
   *      that came from step 1.
   *
   * Other tasks (and clients/vehicles/settings) come straight from the
   * fresh remote, so a stale desktop view can never overwrite mobile work
   * on another task. Retries once on version conflict.
   */
  async patchTaskInCloud(
    taskId: string,
    updates: Partial<Task>,
    retryDepth = 0,
  ): Promise<{ patchedTask: Task | null; snapshot: SyncData } | null> {
    const fresh = await this.pullFromCloud();
    if (!fresh) return null;
    const snap = fresh.data;
    let patched: Task | null = null;
    const nextTasks = (snap.tasks || []).map(t => {
      if (t.id !== taskId) return t;
      patched = { ...t, ...updates } as Task;
      return patched;
    });
    const nextSnap: SyncData = { ...snap, tasks: nextTasks };
    try {
      await this.pushToCloud(nextSnap);
      return { patchedTask: patched, snapshot: nextSnap };
    } catch (err) {
      if (err instanceof VersionConflictError && retryDepth < 2) {
        return this.patchTaskInCloud(taskId, updates, retryDepth + 1);
      }
      throw err;
    }
  },
};

// Re-export Task for the patch helper signature.
import type { Task as _Task } from '@/types';
type Task = _Task;

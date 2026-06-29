import { useState, useEffect, useRef, useCallback } from 'react';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { appSyncService, SyncData, VersionConflictError } from '@/services/appSyncService';
import { Client, Vehicle, Task, Settings, ScheduleEntry } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { dlog } from '@/lib/devLog';

// Pending retry timer (used only when an immediate push fails)
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let cloudPushEnabled = true;

export const setCloudPushEnabled = (enabled: boolean) => {
  cloudPushEnabled = enabled;
  dlog('[CloudSync] Push enabled:', enabled);
};

/**
 * Caller declares which entity ids it just touched. Used to drive merge
 * direction on a VersionConflictError: local wins for these ids, remote
 * wins for everything else.
 */
export interface ChangedIds {
  clients?: string[];
  vehicles?: string[];
  tasks?: string[];
  settingsChanged?: boolean;
}

const byId = <T extends { id: string }>(arr: T[]): Map<string, T> => {
  const m = new Map<string, T>();
  for (const x of arr || []) if (x && x.id) m.set(x.id, x);
  return m;
};

/**
 * 3-way merge: for any id in `changedIds.<entity>`, take local. For all
 * other ids, take remote. Returns the merged snapshot AND a flag noting
 * whether any TRUE overlap occurred — i.e. an id where BOTH local and
 * remote diverged from the common base AND disagree with each other.
 *
 * Edge case: when `base` is null (fresh session, no pull/push yet), we
 * skip overlap detection entirely. Without a base, any divergence could
 * just be local-ahead-of-remote, and a toast would be a false alarm.
 * The merge itself still runs (local wins for changedIds, remote for
 * the rest), so no data is lost.
 */
function mergeOnConflict(
  local: SyncData,
  remote: SyncData,
  base: SyncData | null,
  changed: ChangedIds | undefined
): { merged: SyncData; overlapped: boolean } {
  const ch = changed || {};
  const stringify = (x: any) => JSON.stringify(x);
  const haveBase = !!base;
  let overlapped = false;

  const mergeArr = <T extends { id: string }>(
    localArr: T[],
    remoteArr: T[],
    baseArr: T[] | undefined,
    changedIds: string[] | undefined
  ): T[] => {
    const localMap = byId(localArr);
    const remoteMap = byId(remoteArr);
    const baseMap = byId(baseArr || []);
    const result: T[] = [];
    const taken = new Set<string>();
    const changedSet = new Set(changedIds || []);

    for (const [id, rItem] of remoteMap) {
      if (changedSet.has(id)) {
        const lItem = localMap.get(id);
        if (lItem) {
          if (haveBase) {
            const bItem = baseMap.get(id);
            const localChanged = stringify(lItem) !== stringify(bItem);
            const remoteChanged = stringify(rItem) !== stringify(bItem);
            if (
              localChanged &&
              remoteChanged &&
              stringify(lItem) !== stringify(rItem)
            ) {
              overlapped = true;
            }
          }
          result.push(lItem);
        }
        // If id is in changedSet but no local item, we just deleted it — skip.
      } else {
        result.push(rItem);
      }
      taken.add(id);
    }
    for (const [id, lItem] of localMap) {
      if (!taken.has(id) && changedSet.has(id)) result.push(lItem);
    }
    return result;
  };

  const merged: SyncData = {
    clients: mergeArr(local.clients, remote.clients, base?.clients, ch.clients),
    vehicles: mergeArr(local.vehicles, remote.vehicles, base?.vehicles, ch.vehicles),
    tasks: mergeArr(local.tasks, remote.tasks, base?.tasks, ch.tasks),
    settings: ch.settingsChanged ? local.settings : (remote.settings || local.settings),
  };
  if (ch.settingsChanged && haveBase) {
    const bs = stringify(base!.settings);
    const ls = stringify(local.settings);
    const rs = stringify(remote.settings);
    if (ls !== bs && rs !== bs && ls !== rs) overlapped = true;
  }
  return { merged, overlapped };
}

async function readLocalSnapshot(): Promise<SyncData> {
  const [clients, vehicles, tasks, settings, schedule] = await Promise.all([
    capacitorStorage.getClients(),
    capacitorStorage.getVehicles(),
    capacitorStorage.getTasks(),
    capacitorStorage.getSettings(),
    capacitorStorage.getSchedule(),
  ]);
  return { clients, vehicles, tasks, settings, schedule };
}

async function writeLocalSnapshot(snap: SyncData): Promise<void> {
  await Promise.all([
    capacitorStorage.setClients(snap.clients),
    capacitorStorage.setVehicles(snap.vehicles),
    capacitorStorage.setTasks(snap.tasks),
    capacitorStorage.setSettings(snap.settings),
    capacitorStorage.setSchedule(snap.schedule || []),
  ]);
}

// Push the freshest local snapshot to the cloud immediately (awaitable).
// Used after every add/edit/delete/start/pause/resume/stop so local + cloud
// stay in lockstep. On version conflict, reconcile + retry once. On
// transient failure we schedule ONE retry ~5s later.
const immediatePushToCloud = async (changed?: ChangedIds, retryDepth = 0) => {
  if (!cloudPushEnabled) return;
  // Cancel any pending retry — we're about to push fresh data anyway.
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  try {
    const local = await readLocalSnapshot();
    // Don't push empty snapshots — prevents wiping cloud data
    if (local.clients.length === 0 && local.vehicles.length === 0 && local.tasks.length === 0) {
      dlog('[CloudSync] Skipped push — snapshot is empty');
      return;
    }
    await appSyncService.pushToCloud(local);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      if (retryDepth >= 1) {
        console.error('[CloudSync] Conflict persisted after retry — surfacing to user');
        toast({
          variant: 'destructive',
          title: 'Sync conflict',
          description: 'Please reload to see latest data.',
          duration: 10000,
        });
        return;
      }
      const local = await readLocalSnapshot();
      const base = appSyncService.getBaseSnapshot();
      const { merged, overlapped } = mergeOnConflict(local, err.remoteData, base, changed);
      await writeLocalSnapshot(merged);
      // Notify any cloud-pull listeners so React state can be re-hydrated
      // from the merged snapshot we just persisted.
      cloudSyncEvents.triggerPull();
      if (overlapped) {
        toast({
          variant: 'destructive',
          title: 'Conflicting edits reconciled',
          description: 'Your changes conflicted with a recent sync. Some fields may have been overwritten — please reload if anything looks wrong.',
          duration: 8000,
        });
      }
      // Retry the push with the merged snapshot. lastKnownVersion is now
      // the freshly-pulled remote version, so the conditional update will
      // succeed (unless yet another concurrent write landed).
      return immediatePushToCloud(changed, retryDepth + 1);
    }
    console.error('[CloudSync] Immediate push failed, will retry in 5s:', err);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      immediatePushToCloud(changed).catch(e =>
        console.error('[CloudSync] Retry push failed:', e)
      );
    }, 5000);
  }
};

// For desktop: push current React state directly (passed by caller)
export const pushNow = async (snapshot?: SyncData): Promise<void> => {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  const snap = snapshot || (await readLocalSnapshot());
  try {
    await appSyncService.pushToCloud(snap);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      // Desktop snapshot doesn't track changedIds — treat the entire
      // snapshot as "local wins" and warn the user.
      const allChanged: ChangedIds = {
        clients: snap.clients.map(c => c.id),
        vehicles: snap.vehicles.map(v => v.id),
        tasks: snap.tasks.map(t => t.id),
        settingsChanged: true,
      };
      const base = appSyncService.getBaseSnapshot();
      const { merged, overlapped } = mergeOnConflict(snap, err.remoteData, base, allChanged);
      await writeLocalSnapshot(merged);
      cloudSyncEvents.triggerPull();
      if (overlapped) {
        toast({
          variant: 'destructive',
          title: 'Conflicting edits reconciled',
          description: 'Some fields may have been overwritten by another device. Please reload if anything looks wrong.',
          duration: 8000,
        });
      }
      try {
        await appSyncService.pushToCloud(merged);
      } catch (err2) {
        console.error('[CloudSync] pushNow retry failed:', err2);
        toast({
          variant: 'destructive',
          title: 'Sync conflict',
          description: 'Please reload to see latest data.',
          duration: 10000,
        });
      }
      return;
    }
    throw err;
  }
};

// Event-based sync trigger so pages can force a pull
export const cloudSyncEvents = {
  listeners: [] as Array<() => void>,
  onPull(cb: () => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  },
  triggerPull() {
    this.listeners.forEach(cb => cb());
  },
};

export const useClients = () => {
  const [clients, setClientsState] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const loadedClients = await capacitorStorage.getClients();
        
        // Auto-repair corrupted client data (phone stored as object instead of string)
        let needsRepair = false;
        const sanitizedClients = loadedClients.map(client => {
          let phone = client.phone;
          let email = client.email;
          
          if (phone && typeof phone === 'object') {
            const phoneObj = phone as any;
            phone = phoneObj.number || undefined;
            needsRepair = true;
          } else if (phone && typeof phone !== 'string') {
            phone = undefined;
            needsRepair = true;
          }
          
          if (email && typeof email !== 'string') {
            email = undefined;
            needsRepair = true;
          }
          
          return { ...client, phone, email };
        });
        
        if (needsRepair) {
          await capacitorStorage.setClients(sanitizedClients);
        }
        
        setClientsState(sanitizedClients);
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  const setClients = async (clients: Client[], changedIds?: string[]) => {
    try {
      await capacitorStorage.setClients(clients);
      setClientsState(clients);
      await immediatePushToCloud({ clients: changedIds });
    } catch (error) {
      console.error('Failed to save clients:', error);
    }
  };

  const addClient = async (client: Client) => {
    const updated = [...clients, client];
    await setClients(updated, [client.id]);
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updated = clients.map(c => c.id === id ? { ...c, ...updates } : c);
    await setClients(updated, [id]);
  };

  const deleteClient = async (id: string) => {
    const updated = clients.filter(c => c.id !== id);
    await setClients(updated, [id]);
  };

  const replaceAll = (newClients: Client[]) => {
    setClientsState(newClients);
    capacitorStorage.setClients(newClients);
  };

  return { clients, setClients, addClient, updateClient, deleteClient, replaceAll, loading };
};

export const useVehicles = () => {
  const [vehicles, setVehiclesState] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const loadedVehicles = await capacitorStorage.getVehicles();
        setVehiclesState(loadedVehicles);
      } catch (error) {
        console.error('Failed to load vehicles:', error);
      } finally {
        setLoading(false);
      }
    };
    loadVehicles();
  }, []);

  const setVehicles = async (vehicles: Vehicle[], changedIds?: string[]) => {
    try {
      await capacitorStorage.setVehicles(vehicles);
      setVehiclesState(vehicles);
      await immediatePushToCloud({ vehicles: changedIds });
    } catch (error) {
      console.error('Failed to save vehicles:', error);
    }
  };

  const addVehicle = async (vehicle: Vehicle) => {
    const updated = [...vehicles, vehicle];
    await setVehicles(updated, [vehicle.id]);
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    const updated = vehicles.map(v => v.id === id ? { ...v, ...updates } : v);
    await setVehicles(updated, [id]);
  };

  const deleteVehicle = async (id: string) => {
    const updated = vehicles.filter(v => v.id !== id);
    await setVehicles(updated, [id]);
  };

  const replaceAll = (newVehicles: Vehicle[]) => {
    setVehiclesState(newVehicles);
    capacitorStorage.setVehicles(newVehicles);
  };

  return { vehicles, setVehicles, addVehicle, updateVehicle, deleteVehicle, replaceAll, loading };
};

export const useTasks = () => {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const loadedTasks = await capacitorStorage.getTasks();
        setTasksState(loadedTasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, []);

  const setTasks = async (newTasks: Task[], changedIds?: string[]) => {
    try {
      await capacitorStorage.setTasks(newTasks);
      setTasksState(newTasks);
      await immediatePushToCloud({ tasks: changedIds });
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  const addTask = async (task: Task) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = [...currentTasks, task];
    await setTasks(updated, [task.id]);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    await setTasks(updated, [id]);
  };

  const deleteTask = async (id: string) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.filter(t => t.id !== id);
    await setTasks(updated, [id]);
  };

  const batchUpdateTasks = async (updates: Array<{ id: string; updates: Partial<Task> }>) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.map(task => {
      const update = updates.find(u => u.id === task.id);
      return update ? { ...task, ...update.updates } : task;
    });
    await setTasks(updated, updates.map(u => u.id));
  };

  const replaceAll = (newTasks: Task[]) => {
    setTasksState(newTasks);
    capacitorStorage.setTasks(newTasks);
  };

  return { tasks, setTasks, addTask, updateTask, deleteTask, batchUpdateTasks, replaceAll, loading };
};

export const useSettings = () => {
  const [settings, setSettingsState] = useState<Settings>({ defaultHourlyRate: 75 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await capacitorStorage.getSettings();
        setSettingsState(loadedSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const setSettings = async (settings: Settings) => {
    try {
      await capacitorStorage.setSettings(settings);
      setSettingsState(settings);
      await immediatePushToCloud({ settingsChanged: true });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const replaceAll = (newSettings: Settings) => {
    setSettingsState(newSettings);
    capacitorStorage.setSettings(newSettings);
  };

  return { settings, setSettings, replaceAll, loading };
};

export const useSchedule = () => {
  const [schedule, setScheduleState] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await capacitorStorage.getSchedule();
        setScheduleState(loaded);
      } catch (e) {
        console.error('Failed to load schedule:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setSchedule = async (next: ScheduleEntry[]) => {
    try {
      await capacitorStorage.setSchedule(next);
      setScheduleState(next);
      await immediatePushToCloud({});
    } catch (e) { console.error('Failed to save schedule:', e); }
  };

  const addEntry = async (entry: ScheduleEntry) => {
    const current = await capacitorStorage.getSchedule();
    await setSchedule([...current, entry]);
  };

  const updateEntry = async (id: string, updates: Partial<ScheduleEntry>) => {
    const current = await capacitorStorage.getSchedule();
    await setSchedule(current.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteEntry = async (id: string) => {
    const current = await capacitorStorage.getSchedule();
    await setSchedule(current.filter(s => s.id !== id));
  };

  const replaceAll = (next: ScheduleEntry[]) => {
    setScheduleState(next);
    capacitorStorage.setSchedule(next);
  };

  return { schedule, setSchedule, addEntry, updateEntry, deleteEntry, replaceAll, loading };
};

// Hook for cloud sync - pull on mount, provide refresh
export const useCloudSync = (deps: {
  clients: { replaceAll: (c: Client[]) => void; loading?: boolean };
  vehicles: { replaceAll: (v: Vehicle[]) => void; loading?: boolean };
  tasks: { replaceAll: (t: Task[]) => void; loading?: boolean };
  settings: { replaceAll: (s: Settings) => void; loading?: boolean };
}) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncedForWorkspace = useRef<string | null>(null);
  const { workspace, workspaceReady } = useAuth();

  const pullAndApply = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await appSyncService.pullFromCloud();
      if (result && result.data) {
        const d = result.data;
        if (d.clients) deps.clients.replaceAll(d.clients);
        if (d.vehicles) deps.vehicles.replaceAll(d.vehicles);
        if (d.tasks) deps.tasks.replaceAll(d.tasks);
        if (d.settings) deps.settings.replaceAll(d.settings);
        appSyncService.setLocalUpdatedAt(result.updatedAt);
        setLastSyncAt(result.updatedAt);
        dlog('[CloudSync] Applied remote data');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[CloudSync] Pull failed:', err);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [deps]);

  // Auto-sync when workspace is ready (re-runs on login / workspace change)
  useEffect(() => {
    if (!workspaceReady) return;
    const wsId = workspace?.id ?? null;
    if (!wsId) return;
    if (deps.clients.loading || deps.vehicles.loading || deps.tasks.loading || deps.settings.loading) return;
    if (syncedForWorkspace.current === wsId) return;
    syncedForWorkspace.current = wsId;

    const syncOnReady = async () => {
      try {
        // Always check local first — if empty, pull from cloud
        const [localClients, localVehicles, localTasks, localSettings] = await Promise.all([
          capacitorStorage.getClients(),
          capacitorStorage.getVehicles(),
          capacitorStorage.getTasks(),
          capacitorStorage.getSettings(),
        ]);
        const localEmpty =
          localClients.length === 0 &&
          localVehicles.length === 0 &&
          localTasks.length === 0;

        if (localEmpty) {
          dlog('[CloudSync] Local empty — forcing pull from cloud');
          const pulled = await pullAndApply();
          if (!pulled) syncedForWorkspace.current = null;
          return;
        }

        // Desktop mode (push disabled): always pull, never seed
        if (!cloudPushEnabled) {
          dlog('[CloudSync] Desktop mode — forcing pull');
          const pulled = await pullAndApply();
          if (!pulled) syncedForWorkspace.current = null;
          return;
        }

        const remoteTs = await appSyncService.getRemoteUpdatedAt();
        if (appSyncService.isRemoteNewer(remoteTs)) {
          const pulled = await pullAndApply();
          if (!pulled) syncedForWorkspace.current = null;
        } else if (!remoteTs) {
          await appSyncService.pushToCloud({
            clients: localClients,
            vehicles: localVehicles,
            tasks: localTasks,
            settings: localSettings,
          });
          dlog('[CloudSync] Seeded cloud with local data');
        }
      } catch (err) {
        console.error('[CloudSync] Mount sync failed:', err);
        syncedForWorkspace.current = null;
      }
    };
    syncOnReady();
  }, [workspaceReady, workspace?.id, deps.clients.loading, deps.vehicles.loading, deps.tasks.loading, deps.settings.loading, pullAndApply]);

  return { syncing, lastSyncAt, refresh: pullAndApply };
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { appSyncService, SyncData } from '@/services/appSyncService';
import { Client, Vehicle, Task, Settings } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Global debounce timer for cloud push
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let cloudPushEnabled = true;

export const setCloudPushEnabled = (enabled: boolean) => {
  cloudPushEnabled = enabled;
  console.log('[CloudSync] Push enabled:', enabled);
};

// Build full snapshot from Capacitor storage and push
const debouncedPushToCloud = () => {
  if (!cloudPushEnabled) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const [clients, vehicles, tasks, settings] = await Promise.all([
        capacitorStorage.getClients(),
        capacitorStorage.getVehicles(),
        capacitorStorage.getTasks(),
        capacitorStorage.getSettings(),
      ]);
      // Don't push empty snapshots — prevents wiping cloud data
      if (clients.length === 0 && vehicles.length === 0 && tasks.length === 0) {
        console.log('[CloudSync] Skipped push — snapshot is empty');
        return;
      }
      await appSyncService.pushToCloud({ clients, vehicles, tasks, settings });
    } catch (err) {
      console.error('[CloudSync] Push failed:', err);
    }
  }, 3000);
};

// For desktop: push current React state directly (passed by caller)
export const pushNow = async (snapshot?: SyncData): Promise<void> => {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (snapshot) {
    await appSyncService.pushToCloud(snapshot);
  } else {
    // Fallback: read from storage
    const [clients, vehicles, tasks, settings] = await Promise.all([
      capacitorStorage.getClients(),
      capacitorStorage.getVehicles(),
      capacitorStorage.getTasks(),
      capacitorStorage.getSettings(),
    ]);
    await appSyncService.pushToCloud({ clients, vehicles, tasks, settings });
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

  const setClients = async (clients: Client[]) => {
    try {
      await capacitorStorage.setClients(clients);
      setClientsState(clients);
      debouncedPushToCloud();
    } catch (error) {
      console.error('Failed to save clients:', error);
    }
  };

  const addClient = async (client: Client) => {
    const updated = [...clients, client];
    await setClients(updated);
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updated = clients.map(c => c.id === id ? { ...c, ...updates } : c);
    await setClients(updated);
  };

  const deleteClient = async (id: string) => {
    const updated = clients.filter(c => c.id !== id);
    await setClients(updated);
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

  const setVehicles = async (vehicles: Vehicle[]) => {
    try {
      await capacitorStorage.setVehicles(vehicles);
      setVehiclesState(vehicles);
      debouncedPushToCloud();
    } catch (error) {
      console.error('Failed to save vehicles:', error);
    }
  };

  const addVehicle = async (vehicle: Vehicle) => {
    const updated = [...vehicles, vehicle];
    await setVehicles(updated);
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    const updated = vehicles.map(v => v.id === id ? { ...v, ...updates } : v);
    await setVehicles(updated);
  };

  const deleteVehicle = async (id: string) => {
    const updated = vehicles.filter(v => v.id !== id);
    await setVehicles(updated);
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

  const setTasks = async (newTasks: Task[]) => {
    try {
      await capacitorStorage.setTasks(newTasks);
      setTasksState(newTasks);
      debouncedPushToCloud();
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  const addTask = async (task: Task) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = [...currentTasks, task];
    await setTasks(updated);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    await setTasks(updated);
  };

  const deleteTask = async (id: string) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.filter(t => t.id !== id);
    await setTasks(updated);
  };

  const batchUpdateTasks = async (updates: Array<{ id: string; updates: Partial<Task> }>) => {
    const currentTasks = await capacitorStorage.getTasks();
    const updated = currentTasks.map(task => {
      const update = updates.find(u => u.id === task.id);
      return update ? { ...task, ...update.updates } : task;
    });
    await setTasks(updated);
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
      debouncedPushToCloud();
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

// Hook for cloud sync - pull on mount, provide refresh
export const useCloudSync = (deps: {
  clients: { replaceAll: (c: Client[]) => void };
  vehicles: { replaceAll: (v: Vehicle[]) => void };
  tasks: { replaceAll: (t: Task[]) => void };
  settings: { replaceAll: (s: Settings) => void };
}) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const hasSynced = useRef(false);

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
        console.log('[CloudSync] Applied remote data');
      }
    } catch (err) {
      console.error('[CloudSync] Pull failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [deps]);

  // Auto-sync on mount
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    const syncOnMount = async () => {
      try {
        // Desktop mode (push disabled): always pull, never seed
        if (!cloudPushEnabled) {
          console.log('[CloudSync] Desktop mode — forcing pull');
          await pullAndApply();
          return;
        }

        const remoteTs = await appSyncService.getRemoteUpdatedAt();
        if (appSyncService.isRemoteNewer(remoteTs)) {
          await pullAndApply();
        } else if (!remoteTs) {
          // No remote data — only seed if local actually has data
          const [localClients, localVehicles, localTasks, localSettings] = await Promise.all([
            capacitorStorage.getClients(),
            capacitorStorage.getVehicles(),
            capacitorStorage.getTasks(),
            capacitorStorage.getSettings(),
          ]);
          if (localClients.length > 0 || localTasks.length > 0) {
            await appSyncService.pushToCloud({ clients: localClients, vehicles: localVehicles, tasks: localTasks, settings: localSettings });
            console.log('[CloudSync] Seeded cloud with local data');
          } else {
            console.log('[CloudSync] Skipped seeding — local data is empty');
          }
        }
      } catch (err) {
        console.error('[CloudSync] Mount sync failed:', err);
      }
    };
    syncOnMount();
  }, [pullAndApply]);

  return { syncing, lastSyncAt, refresh: pullAndApply };
};

import { Preferences } from '@capacitor/preferences';
import { Client, Vehicle, Task, Settings } from '@/types';

const STORAGE_KEYS = {
  CLIENTS: 'autotime_clients',
  VEHICLES: 'autotime_vehicles',
  TASKS: 'autotime_tasks',
  SETTINGS: 'autotime_settings',
} as const;

class CapacitorStorage {
  private reviveDates(data: any): any {
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      if (isoDateRegex.test(data)) {
        return new Date(data);
      }
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.reviveDates(item));
    }
    
    if (typeof data === 'object') {
      const revived: any = {};
      for (const key in data) {
        revived[key] = this.reviveDates(data[key]);
      }
      return revived;
    }
    
    return data;
  }

  async getClients(): Promise<Client[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.CLIENTS });
      if (!value) return [];
      const parsed = JSON.parse(value);
      return this.reviveDates(parsed);
    } catch (error) {
      console.error('Failed to get clients from Preferences:', error);
      return [];
    }
  }

  async setClients(clients: Client[]): Promise<void> {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.CLIENTS,
        value: JSON.stringify(clients),
      });
    } catch (error) {
      console.error('Failed to set clients in Preferences:', error);
      throw error;
    }
  }

  async getVehicles(): Promise<Vehicle[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.VEHICLES });
      if (!value) return [];
      const parsed = JSON.parse(value);
      return this.reviveDates(parsed);
    } catch (error) {
      console.error('Failed to get vehicles from Preferences:', error);
      return [];
    }
  }

  async setVehicles(vehicles: Vehicle[]): Promise<void> {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.VEHICLES,
        value: JSON.stringify(vehicles),
      });
    } catch (error) {
      console.error('Failed to set vehicles in Preferences:', error);
      throw error;
    }
  }

  async getTasks(): Promise<Task[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.TASKS });
      if (!value) return [];
      const parsed = JSON.parse(value);
      return this.reviveDates(parsed);
    } catch (error) {
      console.error('Failed to get tasks from Preferences:', error);
      return [];
    }
  }

  async setTasks(tasks: Task[]): Promise<void> {
    try {
      // Phase 2: strip the legacy `billedAmount` field on every save so old
      // records don't drag the field forward in IndexedDB indefinitely.
      const sanitized = tasks.map(t => {
        const { billedAmount: _drop, ...rest } = t as any;
        return rest as Task;
      });
      await Preferences.set({
        key: STORAGE_KEYS.TASKS,
        value: JSON.stringify(sanitized),
      });
    } catch (error) {
      console.error('Failed to set tasks in Preferences:', error);
      throw error;
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SETTINGS });
      if (!value) return { defaultHourlyRate: 75 };
      const parsed = JSON.parse(value);
      return this.reviveDates(parsed);
    } catch (error) {
      console.error('Failed to get settings from Preferences:', error);
      return { defaultHourlyRate: 75 };
    }
  }

  async setSettings(settings: Settings): Promise<void> {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.SETTINGS,
        value: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Failed to set settings in Preferences:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('Failed to clear Preferences:', error);
      throw error;
    }
  }

  async exportAllData() {
    const [clients, vehicles, tasks, settings] = await Promise.all([
      this.getClients(),
      this.getVehicles(),
      this.getTasks(),
      this.getSettings(),
    ]);

    return {
      clients,
      vehicles,
      tasks,
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
  }

  async importAllData(data: any) {
    await this.setClients(data.clients || []);
    await this.setVehicles(data.vehicles || []);
    await this.setTasks(data.tasks || []);
    if (data.settings) {
      await this.setSettings(data.settings);
    }
  }
}

export const capacitorStorage = new CapacitorStorage();

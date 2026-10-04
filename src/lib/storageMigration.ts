import { dlog } from '@/lib/devLog';
import { Preferences } from '@capacitor/preferences';
import { indexedDB } from './indexedDB';
import { capacitorStorage } from './capacitorStorage';

const MIGRATION_KEY = 'autotime_migration_completed';

export async function migrateToCapacitorStorage(): Promise<boolean> {
  try {
    // Check if migration has already been completed
    const { value: migrationCompleted } = await Preferences.get({ key: MIGRATION_KEY });
    if (migrationCompleted === 'true') {
      return false; // Already migrated
    }

    // Check if there's any data in IndexedDB to migrate
    const [clients, vehicles, tasks, settings] = await Promise.all([
      indexedDB.getClients(),
      indexedDB.getVehicles(),
      indexedDB.getTasks(),
      indexedDB.getSettings(),
    ]);

    // Only migrate if there's actual data
    const hasData = clients.length > 0 || vehicles.length > 0 || tasks.length > 0;
    
    if (!hasData) {
      // No data to migrate, just mark as completed
      await Preferences.set({ key: MIGRATION_KEY, value: 'true' });
      return false;
    }

    // Migrate data to Capacitor Preferences
    await Promise.all([
      capacitorStorage.setClients(clients),
      capacitorStorage.setVehicles(vehicles),
      capacitorStorage.setTasks(tasks),
      capacitorStorage.setSettings(settings),
    ]);

    // Mark migration as completed
    await Preferences.set({ key: MIGRATION_KEY, value: 'true' });

    dlog('Migration completed successfully:', {
      clients: clients.length,
      vehicles: vehicles.length,
      tasks: tasks.length,
    });

    return true; // Migration performed
  } catch (error) {
    console.error('Migration failed:', error);
    // Don't mark as completed if migration fails
    return false;
  }
}
